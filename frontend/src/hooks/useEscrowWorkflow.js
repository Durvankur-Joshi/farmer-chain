/**
 * useEscrowWorkflow — Phase 3: MetaMask Assisted Mode
 *
 * Central hook for all blockchain escrow operations in FarmerChain.
 * Provides a 15-phase transaction state machine, wallet/network handling,
 * duplicate-submission prevention, localStorage-based reload recovery,
 * and full Assisted + Manual mode support.
 *
 * SECURITY NOTES:
 *  - Private keys and seed phrases are NEVER accessed or stored.
 *  - MetaMask confirmation is ALWAYS required for every blockchain transaction.
 *  - The hook NEVER auto-confirms wallet popups.
 *  - ETH amounts stored are testnet settlement values only — not crop commercial price.
 *
 * State machine phases:
 *   idle → checking_wallet → connecting_wallet → checking_network → switching_network
 *       → preparing_transaction → awaiting_wallet_confirmation → transaction_submitted
 *       → syncing_backend → completed
 *
 * Error phases (all retryable):
 *   user_rejected | wallet_error | network_error | insufficient_funds | backend_error
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { ethers } from "ethers";
import axios from "axios";
import EscrowABI from "../utils/EscrowABI.json";

/* global __ENV_ESCROW_CONTRACT_ADDRESS__ */
const ESCROW_CONTRACT = __ENV_ESCROW_CONTRACT_ADDRESS__;
const SEPOLIA_CHAIN_ID = "0xaa36a7"; // 11155111

/** localStorage key prefix for pending tx recovery. */
const PENDING_PREFIX = "fc-pending-";

/** Phases where the workflow is "in-flight" (not idle, not terminal). */
const ACTIVE_PHASES = new Set([
  "checking_wallet",
  "connecting_wallet",
  "checking_network",
  "switching_network",
  "preparing_transaction",
  "awaiting_wallet_confirmation",
  "transaction_submitted",
  "syncing_backend",
]);

/** Phases that are terminal errors — user can retry from here. */
const ERROR_PHASES = new Set([
  "user_rejected",
  "wallet_error",
  "network_error",
  "insufficient_funds",
  "backend_error",
]);

// ── LocalStorage helpers ───────────────────────────────────────────────────
function lsSave(key, data) {
  try { localStorage.setItem(PENDING_PREFIX + key, JSON.stringify(data)); } catch {}
}
function lsGet(key) {
  try {
    const raw = localStorage.getItem(PENDING_PREFIX + key);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
function lsClear(key) {
  try { localStorage.removeItem(PENDING_PREFIX + key); } catch {}
}

// ── MetaMask error parser ──────────────────────────────────────────────────
/**
 * Classify a MetaMask/ethers error into a state-machine phase + user message.
 * Never leaks raw internal errors to the user.
 */
function parseMetaMaskError(err) {
  const code = err?.code;
  const msg = (err?.message || "").toLowerCase();
  const reason = err?.reason || "";

  // User explicitly rejected in MetaMask
  if (
    code === 4001 ||
    code === "ACTION_REJECTED" ||
    msg.includes("user rejected") ||
    msg.includes("user denied")
  ) {
    return {
      phase: "user_rejected",
      message: "Transaction cancelled in MetaMask. You can retry when ready.",
    };
  }

  // Insufficient funds
  if (
    code === -32000 ||
    msg.includes("insufficient funds") ||
    msg.includes("insufficient balance")
  ) {
    return {
      phase: "insufficient_funds",
      message:
        "Your wallet does not have enough Sepolia ETH for this blockchain transaction.",
    };
  }

  // Wrong network / network related
  if (
    msg.includes("network") ||
    msg.includes("chain") ||
    msg.includes("sepolia")
  ) {
    return {
      phase: "network_error",
      message:
        "Please switch MetaMask to Ethereum Sepolia (chain ID: 11155111).",
    };
  }

  // Default wallet error
  const display = reason || err?.message || "Unknown error.";
  return {
    phase: "wallet_error",
    message: `MetaMask returned an error: ${display}. Please try again.`,
  };
}

// ── Extract on-chain escrow ID from receipt logs ───────────────────────────
function extractEscrowIdFromReceipt(receipt, fallbackId) {
  try {
    const iface = new ethers.utils.Interface(EscrowABI);
    for (const log of receipt.logs) {
      try {
        const parsed = iface.parseLog(log);
        if (parsed?.name === "EscrowCreated") {
          const rawId = parsed.args.escrowId;
          return rawId ? Number(rawId.toString()) : null;
        }
      } catch {} // skip non-matching logs
    }
  } catch (e) {
    console.warn("[useEscrowWorkflow] Could not parse EscrowCreated log:", e);
  }
  return fallbackId != null ? Number(fallbackId) : null;
}

// ── Main hook ──────────────────────────────────────────────────────────────

/**
 * @param {Object} options
 * @param {'assisted'|'manual'} options.mode      - Workflow mode (assisted = auto-advance, manual = explicit steps)
 * @param {string|null} options.expectedWallet    - Optional wallet address the signer must match
 * @param {Function|null} options.onSuccess       - Called with (txHash, data) on successful completion
 * @param {Function|null} options.onRefresh       - Called with (domains[]) to trigger data refresh
 */
export function useEscrowWorkflow({
  mode = "assisted",
  expectedWallet = null,
  onSuccess = null,
  onRefresh = null,
} = {}) {
  const [phase, setPhase] = useState("idle");
  const [txHash, setTxHash] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
  const [currentEscrow, setCurrentEscrow] = useState(null);
  const [currentAction, setCurrentAction] = useState(null);

  // Ref for synchronous lock — prevents double-submit even within same render cycle
  const isActiveRef = useRef(false);
  const isMountedRef = useRef(true);
  const listenerCleanupRef = useRef(null);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (listenerCleanupRef.current) {
        listenerCleanupRef.current();
        listenerCleanupRef.current = null;
      }
    };
  }, []);

  // Safe state setter — no-ops if component unmounted
  const safe = (fn) => { if (isMountedRef.current) fn(); };

  /**
   * isLocked: true when any workflow action is in progress.
   * UI should disable all action buttons when this is true.
   */
  const isLocked = ACTIVE_PHASES.has(phase) || isActiveRef.current;

  // ── Account & Chain Change Listeners ──────────────────────────────────
  // Registered once per action; cleaned up on unmount or reset.
  const setupChangeListeners = useCallback(() => {
    if (!window.ethereum) return () => {};

    const onAccountsChanged = () => {
      if (!isMountedRef.current) return;
      if (isActiveRef.current) {
        safe(() => {
          setPhase("wallet_error");
          setErrorMessage(
            "Your connected wallet changed while a transaction was in progress. " +
            "Please verify the correct account is active before retrying."
          );
        });
        isActiveRef.current = false;
      }
    };

    const onChainChanged = () => {
      if (!isMountedRef.current) return;
      if (isActiveRef.current) {
        safe(() => {
          setPhase("network_error");
          setErrorMessage(
            "The blockchain network changed while a transaction was in progress. " +
            "Please ensure MetaMask is on Ethereum Sepolia before retrying."
          );
        });
        isActiveRef.current = false;
      }
    };

    window.ethereum.on("accountsChanged", onAccountsChanged);
    window.ethereum.on("chainChanged", onChainChanged);

    return () => {
      window.ethereum?.removeListener("accountsChanged", onAccountsChanged);
      window.ethereum?.removeListener("chainChanged", onChainChanged);
    };
  }, []);

  // ── Wallet Preparation ─────────────────────────────────────────────────
  /**
   * Ensure MetaMask is installed, connected, on Sepolia, and (optionally) the
   * correct account. Returns { provider, signer, contract }.
   *
   * Never accesses private keys. Uses only standard EIP-1193 methods.
   */
  const prepareWallet = useCallback(async (requiredWalletOverride) => {
    // 1. MetaMask detection
    safe(() => setPhase("checking_wallet"));
    if (!window.ethereum) {
      throw Object.assign(
        new Error("MetaMask is not detected. Please install MetaMask to continue."),
        { _phase: "network_error" }
      );
    }

    // 2. Account connection (user may need to approve)
    safe(() => setPhase("connecting_wallet"));
    try {
      await window.ethereum.request({ method: "eth_requestAccounts" });
    } catch (err) {
      throw Object.assign(err, { _phase: "user_rejected" });
    }

    // 3. Network check
    safe(() => setPhase("checking_network"));
    const chainId = await window.ethereum.request({ method: "eth_chainId" });

    if (chainId !== SEPOLIA_CHAIN_ID) {
      // 4. Network switch (user must approve in MetaMask)
      safe(() => setPhase("switching_network"));
      try {
        await window.ethereum.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: SEPOLIA_CHAIN_ID }],
        });
      } catch (switchErr) {
        throw Object.assign(
          new Error(
            "Please switch MetaMask to Ethereum Sepolia (chain ID: 11155111). " +
            "Go to MetaMask → Networks → Ethereum Sepolia."
          ),
          { _phase: "network_error" }
        );
      }
    }

    // 5. Get signer
    const provider = new ethers.providers.Web3Provider(window.ethereum);
    const signer = provider.getSigner();
    const signerAddr = await signer.getAddress();

    // 6. Account match check (if required)
    const walletToVerify = requiredWalletOverride || expectedWallet;
    if (walletToVerify && signerAddr.toLowerCase() !== walletToVerify.toLowerCase()) {
      const short = (addr) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;
      throw Object.assign(
        new Error(
          `Wallet mismatch: This action requires account ${short(walletToVerify)}. ` +
          `Currently connected: ${short(signerAddr)}. ` +
          `Switch MetaMask to the correct account and try again.`
        ),
        { _phase: "wallet_error" }
      );
    }

    // 7. Contract sanity check
    if (!ESCROW_CONTRACT) {
      throw Object.assign(
        new Error("Escrow contract address is not configured. Contact support."),
        { _phase: "wallet_error" }
      );
    }

    const contract = new ethers.Contract(ESCROW_CONTRACT, EscrowABI, signer);
    return { provider, signer, signerAddr, contract };
  }, [expectedWallet]);

  // ── Backend Sync ───────────────────────────────────────────────────────
  /**
   * POST to a backend endpoint. On failure, preserves txHash and enters
   * backend_error phase so the user can retry sync without resubmitting.
   */
  const syncBackend = useCallback(async (endpoint, data) => {
    safe(() => setPhase("syncing_backend"));
    try {
      await axios.post(endpoint, data, { withCredentials: true });
      return true;
    } catch (err) {
      const backendMsg =
        err.response?.data?.error ||
        err.response?.data?.detail ||
        err.message ||
        "Unknown server error";
      safe(() => {
        setPhase("backend_error");
        setErrorMessage(
          `Blockchain transaction succeeded, but FarmerChain could not record it yet: ${backendMsg}. ` +
          `Click "Retry Sync" to record it without resubmitting the blockchain transaction.`
        );
      });
      return false;
    }
  }, []);

  // ── Error Handler ──────────────────────────────────────────────────────
  const handleError = useCallback((err) => {
    console.error("[useEscrowWorkflow] Error:", err);
    isActiveRef.current = false;

    if (!isMountedRef.current) return;

    // Pre-tagged errors (from prepareWallet / our own throws)
    if (err._phase) {
      setPhase(err._phase);
      setErrorMessage(err.message);
      return;
    }

    // Axios/backend errors
    if (err.response) {
      const msg =
        err.response?.data?.error ||
        err.response?.data?.detail ||
        "Server error";
      setPhase("backend_error");
      setErrorMessage(
        `FarmerChain returned an error: ${msg}. ` +
        `The blockchain transaction has NOT been submitted. Please try again.`
      );
      return;
    }

    // MetaMask/ethers errors
    const { phase: errPhase, message: errMsg } = parseMetaMaskError(err);
    setPhase(errPhase);
    setErrorMessage(errMsg);
  }, []);

  // ── Action Entry Guard ─────────────────────────────────────────────────
  const beginAction = useCallback((escrow, action) => {
    if (isActiveRef.current) return false; // double-click protection
    isActiveRef.current = true;

    safe(() => {
      setPhase("checking_wallet");
      setCurrentEscrow(escrow);
      setCurrentAction(action);
      setTxHash(null);
      setErrorMessage(null);
    });

    // Register change listeners for this action's duration
    if (listenerCleanupRef.current) listenerCleanupRef.current();
    listenerCleanupRef.current = setupChangeListeners();

    return true;
  }, [setupChangeListeners]);

  const finishAction = useCallback((escrowKey, txHashVal, refreshDomains, data) => {
    lsClear(escrowKey);
    isActiveRef.current = false;
    safe(() => setPhase("completed"));
    if (onSuccess) onSuccess(txHashVal, data);
    if (onRefresh) onRefresh(refreshDomains);
  }, [onSuccess, onRefresh]);

  // ══════════════════════════════════════════════════════════════════════
  // FARMER ESCROW OPERATIONS
  // ══════════════════════════════════════════════════════════════════════

  /**
   * STEP 1 (Farmer): Create backend record + on-chain escrow.
   * Farmer → createEscrow(fpoWallet, amountWei, quoteId)
   */
  const runCreateEscrow = useCallback(async (quote) => {
    if (!beginAction(quote, "create_escrow")) return;
    const pendingKey = `quote-${quote.id}`;
    lsSave(pendingKey, { action: "create_escrow", txHash: null, ts: Date.now() });

    try {
      // 1. Backend: create DB record
      safe(() => setPhase("preparing_transaction"));
      const res = await axios.post(
        "/api/escrow/create/",
        { quote_id: quote.id },
        { withCredentials: true }
      );
      const escrowData = res.data;

      // Validate ETH amount (testnet infrastructure value)
      const amountNum = parseFloat(escrowData.amount_eth);
      if (isNaN(amountNum) || amountNum <= 0) {
        throw Object.assign(
          new Error(`Invalid testnet ETH amount (${escrowData.amount_eth}). Check bid configuration.`),
          { _phase: "wallet_error" }
        );
      }

      // 2. Wallet: check + connect + network (farmer's wallet)
      const { contract } = await prepareWallet(escrowData.farmer_wallet);

      if (!escrowData.fpo_wallet) {
        throw Object.assign(new Error("FPO buyer wallet address is missing."), { _phase: "wallet_error" });
      }

      // 3. On-chain: createEscrow — MetaMask popup opens here
      safe(() => setPhase("awaiting_wallet_confirmation"));
      const amountWei = ethers.utils.parseEther(String(escrowData.amount_eth));
      const tx = await contract.createEscrow(escrowData.fpo_wallet, amountWei, quote.id);

      // 4. Wait for block confirmation
      safe(() => { setPhase("transaction_submitted"); setTxHash(tx.hash); });
      lsSave(pendingKey, { action: "create_escrow", txHash: tx.hash, ts: Date.now() });

      const receipt = await tx.wait();
      const onChainId = extractEscrowIdFromReceipt(receipt, quote.id);
      if (onChainId === null) {
        throw Object.assign(
          new Error("Transaction confirmed but EscrowCreated event could not be decoded."),
          { _phase: "wallet_error" }
        );
      }

      // 5. Backend sync
      const backendId = escrowData.id ?? escrowData.escrow?.id;
      const synced = await syncBackend(
        `/api/escrow/${backendId}/created-onchain/`,
        { tx_hash: receipt.transactionHash, escrow_id: onChainId, contract_address: ESCROW_CONTRACT }
      );
      if (synced) finishAction(pendingKey, receipt.transactionHash, ["escrow", "deals", "quotes", "farmer", "fpo"], { escrowId: onChainId });

    } catch (err) {
      handleError(err);
    }
  }, [beginAction, prepareWallet, syncBackend, finishAction, handleError]);

  /**
   * STEP 1b (Farmer): Complete on-chain registration for an existing DB-only escrow.
   * Used when the DB record exists but escrow_id is not yet set (on-chain step was skipped).
   */
  const runCompleteOnchain = useCallback(async (escrow) => {
    if (!beginAction(escrow, "complete_onchain")) return;
    const pendingKey = `escrow-${escrow.id}`;
    lsSave(pendingKey, { action: "complete_onchain", txHash: null, ts: Date.now() });

    try {
      const amountNum = parseFloat(escrow.amount_eth);
      if (isNaN(amountNum) || amountNum <= 0) {
        throw Object.assign(new Error(`Invalid testnet ETH amount: ${escrow.amount_eth}`), { _phase: "wallet_error" });
      }

      const { contract } = await prepareWallet(escrow.farmer_wallet);

      if (!escrow.fpo_wallet) {
        throw Object.assign(new Error("FPO buyer wallet address is missing."), { _phase: "wallet_error" });
      }

      safe(() => setPhase("awaiting_wallet_confirmation"));
      const amountWei = ethers.utils.parseEther(String(escrow.amount_eth));
      const quoteId = escrow.quote_id ?? escrow.id;
      const tx = await contract.createEscrow(escrow.fpo_wallet, amountWei, quoteId);

      safe(() => { setPhase("transaction_submitted"); setTxHash(tx.hash); });
      lsSave(pendingKey, { action: "complete_onchain", txHash: tx.hash, ts: Date.now() });

      const receipt = await tx.wait();
      const onChainId = extractEscrowIdFromReceipt(receipt, quoteId);
      if (onChainId === null) {
        throw Object.assign(
          new Error("Transaction confirmed but EscrowCreated event could not be decoded."),
          { _phase: "wallet_error" }
        );
      }

      const synced = await syncBackend(
        `/api/escrow/${escrow.id}/created-onchain/`,
        { tx_hash: receipt.transactionHash, escrow_id: onChainId, contract_address: ESCROW_CONTRACT }
      );
      if (synced) finishAction(pendingKey, receipt.transactionHash, ["escrow", "deals", "quotes", "farmer", "fpo"], { escrowId: onChainId });

    } catch (err) {
      handleError(err);
    }
  }, [beginAction, prepareWallet, syncBackend, finishAction, handleError]);

  /**
   * STEP 2 (FPO): Deposit ETH into farmer escrow.
   * FPO → depositEscrow(escrowId) payable
   */
  const runFundEscrow = useCallback(async (escrow) => {
    if (!beginAction(escrow, "fund_escrow")) return;
    const pendingKey = `escrow-${escrow.id}`;
    lsSave(pendingKey, { action: "fund_escrow", txHash: null, ts: Date.now() });

    try {
      if (!escrow.escrow_id) {
        throw Object.assign(
          new Error("Blockchain escrow not created yet. The farmer must complete on-chain registration first."),
          { _phase: "wallet_error" }
        );
      }

      const amountNum = parseFloat(escrow.amount_eth);
      if (isNaN(amountNum) || amountNum <= 0) {
        throw Object.assign(new Error(`Invalid testnet ETH amount: ${escrow.amount_eth}`), { _phase: "wallet_error" });
      }

      const { contract } = await prepareWallet(escrow.fpo_wallet);

      safe(() => setPhase("awaiting_wallet_confirmation"));
      const amountWei = ethers.utils.parseEther(String(escrow.amount_eth));
      const tx = await contract.depositEscrow(escrow.escrow_id, { value: amountWei });

      safe(() => { setPhase("transaction_submitted"); setTxHash(tx.hash); });
      lsSave(pendingKey, { action: "fund_escrow", txHash: tx.hash, ts: Date.now() });

      const receipt = await tx.wait();
      const synced = await syncBackend(
        `/api/escrow/${escrow.id}/funded/`,
        { tx_hash: receipt.transactionHash, escrow_id: escrow.escrow_id }
      );
      if (synced) finishAction(pendingKey, receipt.transactionHash, ["escrow", "deals", "quotes", "fpo", "farmer"], escrow);

    } catch (err) {
      handleError(err);
    }
  }, [beginAction, prepareWallet, syncBackend, finishAction, handleError]);

  /**
   * STEP 3 (Farmer): Confirm delivery on-chain.
   * Farmer → confirmDelivery(escrowId)
   */
  const runConfirmDelivery = useCallback(async (escrow) => {
    if (!beginAction(escrow, "confirm_delivery")) return;
    const pendingKey = `escrow-${escrow.id}`;
    lsSave(pendingKey, { action: "confirm_delivery", txHash: null, ts: Date.now() });

    try {
      if (!escrow.escrow_id) {
        throw Object.assign(new Error("On-chain escrow ID missing."), { _phase: "wallet_error" });
      }

      const { contract } = await prepareWallet(escrow.farmer_wallet);

      safe(() => setPhase("awaiting_wallet_confirmation"));
      const tx = await contract.confirmDelivery(escrow.escrow_id);

      safe(() => { setPhase("transaction_submitted"); setTxHash(tx.hash); });
      lsSave(pendingKey, { action: "confirm_delivery", txHash: tx.hash, ts: Date.now() });

      const receipt = await tx.wait();
      const synced = await syncBackend(
        `/api/escrow/${escrow.id}/delivery-confirm/`,
        { tx_hash: receipt.transactionHash }
      );
      if (synced) finishAction(pendingKey, receipt.transactionHash, ["escrow", "deals", "quotes", "farmer", "fpo", "transactions"], escrow);

    } catch (err) {
      handleError(err);
    }
  }, [beginAction, prepareWallet, syncBackend, finishAction, handleError]);

  /**
   * STEP 4 (FPO): Release payment to farmer.
   * FPO → releasePayment(escrowId)
   */
  const runReleasePayment = useCallback(async (escrow) => {
    if (!beginAction(escrow, "release_payment")) return;
    const pendingKey = `escrow-${escrow.id}`;
    lsSave(pendingKey, { action: "release_payment", txHash: null, ts: Date.now() });

    try {
      if (!escrow.escrow_id) {
        throw Object.assign(new Error("On-chain escrow ID missing."), { _phase: "wallet_error" });
      }

      const { contract } = await prepareWallet(escrow.fpo_wallet);

      safe(() => setPhase("awaiting_wallet_confirmation"));
      const tx = await contract.releasePayment(escrow.escrow_id);

      safe(() => { setPhase("transaction_submitted"); setTxHash(tx.hash); });
      lsSave(pendingKey, { action: "release_payment", txHash: tx.hash, ts: Date.now() });

      const receipt = await tx.wait();
      const synced = await syncBackend(
        `/api/escrow/${escrow.id}/released/`,
        { tx_hash: receipt.transactionHash }
      );
      if (synced) finishAction(pendingKey, receipt.transactionHash, ["escrow", "deals", "quotes", "fpo", "farmer", "inventory", "transactions"], escrow);

    } catch (err) {
      handleError(err);
    }
  }, [beginAction, prepareWallet, syncBackend, finishAction, handleError]);

  // ══════════════════════════════════════════════════════════════════════
  // RETAILER ESCROW OPERATIONS
  // ══════════════════════════════════════════════════════════════════════

  /**
   * STEP 1 (FPO): Create retailer escrow — backend record + on-chain.
   * FPO → createEscrow(retailerWallet, amountWei, quoteId)
   */
  const runCreateRetailerEscrow = useCallback(async (quote) => {
    if (!beginAction(quote, "create_retailer_escrow")) return;
    const pendingKey = `rquote-${quote.id}`;
    lsSave(pendingKey, { action: "create_retailer_escrow", txHash: null, ts: Date.now() });

    try {
      safe(() => setPhase("preparing_transaction"));
      const res = await axios.post(
        `/api/escrow/retailer/${quote.id}/create/`,
        {},
        { withCredentials: true }
      );
      const escrowData = res.data;

      const { contract } = await prepareWallet(escrowData.fpo_wallet);

      if (!escrowData.retailer_wallet) {
        throw Object.assign(new Error("Retailer buyer wallet address is missing."), { _phase: "wallet_error" });
      }

      safe(() => setPhase("awaiting_wallet_confirmation"));
      const amountWei = ethers.utils.parseEther(String(escrowData.amount_eth));
      const tx = await contract.createEscrow(escrowData.retailer_wallet, amountWei, quote.id);

      safe(() => { setPhase("transaction_submitted"); setTxHash(tx.hash); });
      lsSave(pendingKey, { action: "create_retailer_escrow", txHash: tx.hash, ts: Date.now() });

      const receipt = await tx.wait();
      const onChainId = extractEscrowIdFromReceipt(receipt, quote.id);
      if (onChainId === null) {
        throw Object.assign(
          new Error("Transaction confirmed but EscrowCreated event could not be decoded."),
          { _phase: "wallet_error" }
        );
      }

      const backendId = escrowData.id ?? escrowData.escrow?.id;
      const synced = await syncBackend(
        `/api/escrow/retailer/${backendId}/created-onchain/`,
        { tx_hash: receipt.transactionHash, escrow_id: onChainId, contract_address: ESCROW_CONTRACT }
      );
      if (synced) finishAction(pendingKey, receipt.transactionHash, ["escrow", "deals", "quotes", "fpo", "retailer"], { escrowId: onChainId });

    } catch (err) {
      handleError(err);
    }
  }, [beginAction, prepareWallet, syncBackend, finishAction, handleError]);

  /**
   * STEP 2 (Retailer): Fund retailer escrow.
   * Retailer → depositEscrow(escrowId) payable
   */
  const runFundRetailerEscrow = useCallback(async (escrow) => {
    if (!beginAction(escrow, "fund_retailer_escrow")) return;
    const pendingKey = `rescrow-${escrow.id}`;
    lsSave(pendingKey, { action: "fund_retailer_escrow", txHash: null, ts: Date.now() });

    try {
      if (!escrow.escrow_id) {
        throw Object.assign(
          new Error("FPO must initialize the on-chain escrow agreement first."),
          { _phase: "wallet_error" }
        );
      }

      const amountNum = parseFloat(escrow.amount_eth);
      if (isNaN(amountNum) || amountNum <= 0) {
        throw Object.assign(new Error(`Invalid testnet ETH amount: ${escrow.amount_eth}`), { _phase: "wallet_error" });
      }

      const { contract } = await prepareWallet(escrow.retailer_wallet);

      safe(() => setPhase("awaiting_wallet_confirmation"));
      const amountWei = ethers.utils.parseEther(String(escrow.amount_eth));
      const tx = await contract.depositEscrow(escrow.escrow_id, { value: amountWei });

      safe(() => { setPhase("transaction_submitted"); setTxHash(tx.hash); });
      lsSave(pendingKey, { action: "fund_retailer_escrow", txHash: tx.hash, ts: Date.now() });

      const receipt = await tx.wait();
      const synced = await syncBackend(
        `/api/escrow/retailer/${escrow.id}/funded/`,
        { tx_hash: receipt.transactionHash, escrow_id: escrow.escrow_id }
      );
      if (synced) finishAction(pendingKey, receipt.transactionHash, ["escrow", "deals", "quotes", "retailer", "fpo"], escrow);

    } catch (err) {
      handleError(err);
    }
  }, [beginAction, prepareWallet, syncBackend, finishAction, handleError]);

  /**
   * STEP 3 (FPO): Confirm delivery to retailer.
   * FPO → confirmDelivery(escrowId)
   */
  const runConfirmRetailerDelivery = useCallback(async (escrow) => {
    if (!beginAction(escrow, "confirm_retailer_delivery")) return;
    const pendingKey = `rescrow-${escrow.id}`;
    lsSave(pendingKey, { action: "confirm_retailer_delivery", txHash: null, ts: Date.now() });

    try {
      if (!escrow.escrow_id) {
        throw Object.assign(new Error("On-chain escrow ID missing."), { _phase: "wallet_error" });
      }

      const { contract } = await prepareWallet(escrow.fpo_wallet);

      safe(() => setPhase("awaiting_wallet_confirmation"));
      const tx = await contract.confirmDelivery(escrow.escrow_id);

      safe(() => { setPhase("transaction_submitted"); setTxHash(tx.hash); });
      lsSave(pendingKey, { action: "confirm_retailer_delivery", txHash: tx.hash, ts: Date.now() });

      const receipt = await tx.wait();
      const synced = await syncBackend(
        `/api/escrow/retailer/${escrow.id}/delivery-confirm/`,
        { tx_hash: receipt.transactionHash }
      );
      if (synced) finishAction(pendingKey, receipt.transactionHash, ["escrow", "deals", "quotes", "fpo", "retailer"], escrow);

    } catch (err) {
      handleError(err);
    }
  }, [beginAction, prepareWallet, syncBackend, finishAction, handleError]);

  /**
   * STEP 4 (Retailer): Release payment to FPO; stock added to retailer inventory.
   * Retailer → releasePayment(escrowId)
   */
  const runReleaseRetailerPayment = useCallback(async (escrow) => {
    if (!beginAction(escrow, "release_retailer_payment")) return;
    const pendingKey = `rescrow-${escrow.id}`;
    lsSave(pendingKey, { action: "release_retailer_payment", txHash: null, ts: Date.now() });

    try {
      if (!escrow.escrow_id) {
        throw Object.assign(new Error("On-chain escrow ID missing."), { _phase: "wallet_error" });
      }

      const { contract } = await prepareWallet(escrow.retailer_wallet);

      safe(() => setPhase("awaiting_wallet_confirmation"));
      const tx = await contract.releasePayment(escrow.escrow_id);

      safe(() => { setPhase("transaction_submitted"); setTxHash(tx.hash); });
      lsSave(pendingKey, { action: "release_retailer_payment", txHash: tx.hash, ts: Date.now() });

      const receipt = await tx.wait();
      const synced = await syncBackend(
        `/api/escrow/retailer/${escrow.id}/released/`,
        { tx_hash: receipt.transactionHash }
      );
      if (synced) finishAction(pendingKey, receipt.transactionHash, ["escrow", "deals", "quotes", "retailer", "fpo", "inventory", "transactions"], escrow);

    } catch (err) {
      handleError(err);
    }
  }, [beginAction, prepareWallet, syncBackend, finishAction, handleError]);

  // ── Retry Backend Sync (after backend_error) ───────────────────────────
  /**
   * Re-POST a known transaction hash to the backend without resubmitting on-chain.
   * Only callable from `backend_error` phase — safe to retry multiple times.
   */
  const retryBackendSync = useCallback(async (endpoint, data) => {
    if (!ERROR_PHASES.has(phase) && phase !== "backend_error") return;

    safe(() => setPhase("syncing_backend"));
    try {
      await axios.post(endpoint, data, { withCredentials: true });
      isActiveRef.current = false;
      safe(() => setPhase("completed"));
      if (onSuccess) onSuccess(data.tx_hash, null);
      if (onRefresh) onRefresh(["escrow", "deals", "inventory", "farmer", "fpo", "retailer", "transactions"]);
    } catch (err) {
      const msg =
        err.response?.data?.error ||
        err.response?.data?.detail ||
        err.message ||
        "Unknown error";
      safe(() => {
        setPhase("backend_error");
        setErrorMessage(
          `Still unable to record: ${msg}. ` +
          `Your blockchain transaction (${data.tx_hash}) is confirmed. Contact support if this continues.`
        );
      });
    }
  }, [phase, onSuccess, onRefresh]);

  // ── Reload Recovery ────────────────────────────────────────────────────
  /**
   * Check localStorage for a pending transaction hash for an escrow.
   * Call this on mount for each escrow in the list to detect recovery scenarios.
   */
  const getPendingRecovery = useCallback((escrowId, prefix = "escrow") => {
    return lsGet(`${prefix}-${escrowId}`);
  }, []);

  const clearRecovery = useCallback((escrowId, prefix = "escrow") => {
    lsClear(`${prefix}-${escrowId}`);
  }, []);

  // ── Reset ──────────────────────────────────────────────────────────────
  const reset = useCallback(() => {
    isActiveRef.current = false;
    if (listenerCleanupRef.current) {
      listenerCleanupRef.current();
      listenerCleanupRef.current = null;
    }
    safe(() => {
      setPhase("idle");
      setTxHash(null);
      setErrorMessage(null);
      setCurrentEscrow(null);
      setCurrentAction(null);
    });
  }, []);

  // ── Public API ─────────────────────────────────────────────────────────
  return {
    // State
    phase,
    txHash,
    errorMessage,
    currentEscrow,
    currentAction,
    isLocked,

    // Farmer operations
    runCreateEscrow,
    runCompleteOnchain,
    runConfirmDelivery,

    // FPO → Farmer operations
    runFundEscrow,
    runReleasePayment,

    // FPO → Retailer operations
    runCreateRetailerEscrow,
    runConfirmRetailerDelivery,

    // Retailer operations
    runFundRetailerEscrow,
    runReleaseRetailerPayment,

    // Recovery
    retryBackendSync,
    getPendingRecovery,
    clearRecovery,

    // Lifecycle
    reset,
  };
}
