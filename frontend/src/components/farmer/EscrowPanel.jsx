import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { ethers } from "ethers";
import { useRefresh, useRefreshSubscription } from "../../context/useRefresh";
import EscrowABI from "../../utils/EscrowABI.json";
import EscrowDealCard from "../common/EscrowDealCard";
import EscrowDealModal from "../common/EscrowDealModal";

const ESCROW_CONTRACT = __ENV_ESCROW_CONTRACT_ADDRESS__;
const SEPOLIA_CHAIN_ID = "0xaa36a7"; // 11155111

export default function EscrowPanel({ onEscrowUpdated }) {
  const { refresh } = useRefresh();
  const [escrows, setEscrows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [txStatus, setTxStatus] = useState({});
  const [activeModalEscrow, setActiveModalEscrow] = useState(null);

  // Accepted quotes without escrows
  const [acceptedQuotes, setAcceptedQuotes] = useState([]);

  const fetchEscrows = useCallback(async () => {
    try {
      const res = await axios.get("/api/escrow/my/", { withCredentials: true });
      setEscrows(res.data.escrows || []);
    } catch (err) {
      console.error("Error fetching escrows:", err);
    }
  }, []);

  const fetchAcceptedQuotes = useCallback(async () => {
    try {
      const res = await axios.get("/api/farmer/quotes/", { withCredentials: true });
      const quotes = res.data || [];
      const accepted = quotes.filter(
        (q) => q.accepted_bid && q.status !== "open"
      );
      setAcceptedQuotes(accepted);
    } catch (err) {
      console.error("Error fetching quotes:", err);
    }
  }, []);

  useEffect(() => {
    Promise.all([fetchEscrows(), fetchAcceptedQuotes()]).finally(() =>
      setLoading(false)
    );
  }, [fetchEscrows, fetchAcceptedQuotes]);

  useRefreshSubscription(["escrow", "deals", "quotes", "farmer", "fpo"], () => {
    fetchEscrows();
    fetchAcceptedQuotes();
  });

  // ── Helpers ─────────────────────────────────────────────────────

  const ensureSepolia = async () => {
    if (!window.ethereum) throw new Error("MetaMask is not installed. Please install MetaMask to interact with Sepolia smart contracts.");
    const chainId = await window.ethereum.request({ method: "eth_chainId" });
    if (chainId !== SEPOLIA_CHAIN_ID) {
      try {
        await window.ethereum.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: SEPOLIA_CHAIN_ID }],
        });
      } catch {
        throw new Error("Please switch MetaMask network to Ethereum Sepolia Testnet.");
      }
    }
  };

  const getContract = async () => {
    if (!ESCROW_CONTRACT) throw new Error("Escrow contract address is not configured. Please set ESCROW_CONTRACT_ADDRESS.");
    await ensureSepolia();
    const provider = new ethers.providers.Web3Provider(window.ethereum);
    await provider.send("eth_requestAccounts", []);
    const signer = provider.getSigner();
    return new ethers.Contract(ESCROW_CONTRACT, EscrowABI, signer);
  };

  const extractEscrowId = (receipt, fallbackQuoteId) => {
    try {
      const iface = new ethers.utils.Interface(EscrowABI);
      for (const log of receipt.logs) {
        try {
          const parsed = iface.parseLog(log);
          if (parsed && parsed.name === "EscrowCreated") {
            const rawId = parsed.args.escrowId;
            return rawId ? Number(rawId.toString()) : null;
          }
        } catch {
          // not this event
        }
      }
    } catch (e) {
      console.warn("Could not parse EscrowCreated log:", e);
    }
    return fallbackQuoteId ? Number(fallbackQuoteId) : null;
  };

  const setTx = (id, update) =>
    setTxStatus((prev) => ({ ...prev, [id]: { ...(prev[id] || {}), ...update } }));

  // ── Create Escrow for Accepted Quote ───────────────────────────

  const createEscrow = async (quote) => {
    const key = `create-${quote.id}`;
    try {
      setTx(key, { loading: true, error: null, success: null });

      // Step 1: Create backend escrow record
      const res = await axios.post(
        `/api/escrow/farmer/${quote.id}/create/`,
        {},
        { withCredentials: true }
      );
      const escrowData = res.data;

      // Validate ETH amount
      const amountNum = parseFloat(escrowData.amount_eth);
      if (isNaN(amountNum) || amountNum <= 0) {
        throw new Error(
          `Invalid escrow amount: ${escrowData.amount_eth} ETH. ` +
          "Please verify that the accepted bid had a valid positive ETH rate."
        );
      }
      if (amountNum > 100) {
        throw new Error(
          `Safety Warning: Escrow amount is ${amountNum} ETH. ` +
          "Please check that the rate was set in ETH per unit."
        );
      }

      // Step 2: Create on-chain escrow
      const contract = await getContract();
      const amountWei = ethers.utils.parseEther(String(escrowData.amount_eth));
      const fpoWallet = escrowData.fpo_wallet;
      if (!fpoWallet) throw new Error("FPO buyer wallet address is missing.");

      setTx(key, { loading: true, success: "Please confirm createEscrow in MetaMask…" });
      const tx = await contract.createEscrow(fpoWallet, amountWei, quote.id);

      setTx(key, { loading: true, success: "Waiting for Sepolia blockchain confirmation…" });
      const receipt = await tx.wait();

      const onChainId = extractEscrowId(receipt, quote.id);
      if (onChainId === null) {
        throw new Error("Transaction confirmed, but EscrowCreated event could not be decoded.");
      }

      // Step 3: Record on-chain tx & escrow_id in backend
      await axios.post(
        `/api/escrow/${escrowData.id}/created-onchain/`,
        { tx_hash: receipt.transactionHash, escrow_id: onChainId, contract_address: ESCROW_CONTRACT },
        { withCredentials: true }
      );

      setTx(key, { loading: false, success: `On-Chain Escrow #${onChainId} created on Sepolia! ✅` });
      await Promise.all([fetchEscrows(), fetchAcceptedQuotes()]);
      if (onEscrowUpdated) onEscrowUpdated();
      refresh(["escrow", "deals", "quotes", "farmer", "fpo"]);
    } catch (err) {
      console.error("Create escrow error:", err);
      let msg =
        err.response?.data?.error ||
        err.reason ||
        err.message ||
        "Failed to create escrow.";
      if (err.code === 4001 || err.code === "ACTION_REJECTED") {
        msg = "Transaction was rejected in MetaMask.";
      }
      setTx(key, { loading: false, error: msg });
    }
  };

  // ── Complete On-Chain Escrow for Existing Database Record ───────

  const completeOnchainEscrow = async (escrow) => {
    const key = `complete-onchain-${escrow.id}`;
    try {
      setTx(key, { loading: true, error: null, success: null });

      const amountNum = parseFloat(escrow.amount_eth);
      if (isNaN(amountNum) || amountNum <= 0) {
        throw new Error(`Invalid escrow amount: ${escrow.amount_eth} ETH.`);
      }

      const amountWei = ethers.utils.parseEther(String(escrow.amount_eth));
      if (!escrow.fpo_wallet) {
        throw new Error("FPO buyer wallet address is missing.");
      }

      setTx(key, { loading: true, success: "Please confirm createEscrow in MetaMask…" });

      const contract = await getContract();
      const quoteId = escrow.quote_id || escrow.id;
      const tx = await contract.createEscrow(escrow.fpo_wallet, amountWei, quoteId);

      setTx(key, { loading: true, success: "Waiting for Sepolia blockchain confirmation…" });
      const receipt = await tx.wait();

      const onChainId = extractEscrowId(receipt, quoteId);
      if (onChainId === null) {
        throw new Error("Transaction confirmed, but EscrowCreated event could not be decoded.");
      }

      await axios.post(
        `/api/escrow/${escrow.id}/created-onchain/`,
        { tx_hash: receipt.transactionHash, escrow_id: onChainId, contract_address: ESCROW_CONTRACT },
        { withCredentials: true }
      );

      setTx(key, { loading: false, success: `On-Chain Escrow #${onChainId} created on Sepolia! ✅` });
      await Promise.all([fetchEscrows(), fetchAcceptedQuotes()]);
      if (onEscrowUpdated) onEscrowUpdated();
      refresh(["escrow", "deals", "quotes", "farmer", "fpo"]);
    } catch (err) {
      console.error("Complete onchain escrow error:", err);
      let msg =
        err.response?.data?.error ||
        err.reason ||
        err.message ||
        "Failed to complete on-chain escrow.";
      if (err.code === 4001 || err.code === "ACTION_REJECTED") {
        msg = "Transaction was rejected in MetaMask.";
      }
      setTx(key, { loading: false, error: msg });
    }
  };

  // ── Confirm Delivery ────────────────────────────────────────────

  const confirmDelivery = async (escrow) => {
    const key = `delivery-${escrow.id}`;
    let receipt = null;
    try {
      setTx(key, { loading: true, error: null, success: null });

      if (!escrow.escrow_id) throw new Error("On-chain escrow ID missing.");

      const contract = await getContract();
      setTx(key, { loading: true, success: "Please confirm delivery handover via MetaMask…" });

      const tx = await contract.confirmDelivery(escrow.escrow_id);
      setTx(key, { loading: true, success: "Waiting for Sepolia blockchain confirmation…" });
      receipt = await tx.wait();

      await axios.post(
        `/api/escrow/${escrow.id}/delivery-confirm/`,
        { tx_hash: receipt.transactionHash },
        { withCredentials: true }
      );

      setTx(key, { loading: false, success: "Delivery handover confirmed on Sepolia! ✅" });
      await fetchEscrows();
      if (onEscrowUpdated) onEscrowUpdated();
      refresh(["escrow", "deals", "quotes", "farmer", "fpo", "transactions"]);
    } catch (err) {
      console.error("Confirm delivery error:", err);
      let msg =
        err.response?.data?.error ||
        err.reason ||
        err.message ||
        "Failed to confirm delivery.";
      if (err.code === 4001 || err.code === "ACTION_REJECTED") {
        msg = "Transaction was rejected in MetaMask.";
      }
      setTx(key, { loading: false, error: msg });
    }
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2].map((i) => (
          <div key={i} className="bg-slate-50 border border-slate-200/60 rounded-2xl p-5 animate-pulse space-y-2">
            <div className="h-4 bg-slate-200 rounded w-1/4"></div>
            <div className="h-10 bg-slate-200 rounded"></div>
          </div>
        ))}
      </div>
    );
  }

  // Find quotes that don't have an escrow record yet
  const existingEscrowQuoteIds = escrows.map((e) => e.quote_id);
  const quotesNeedingEscrow = acceptedQuotes.filter(
    (q) => !existingEscrowQuoteIds.includes(q.id)
  );

  // Derive action button for active modal escrow
  const renderModalAction = (escrow) => {
    if (!escrow) return null;
    const completeKey = `complete-onchain-${escrow.id}`;
    const deliveryKey = `delivery-${escrow.id}`;
    const completeTx = txStatus[completeKey] || {};
    const deliveryTx = txStatus[deliveryKey] || {};

    if (escrow.status === "created" && !escrow.escrow_id) {
      return (
        <button
          type="button"
          onClick={() => completeOnchainEscrow(escrow)}
          disabled={completeTx.loading}
          className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50 text-xs"
        >
          <span>🔐</span>
          <span>{completeTx.loading ? "Executing createEscrow…" : "Complete On-Chain Escrow (MetaMask)"}</span>
        </button>
      );
    }

    if (escrow.status === "funded") {
      return (
        <button
          type="button"
          onClick={() => confirmDelivery(escrow)}
          disabled={deliveryTx.loading}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50 text-xs"
        >
          <span>📦</span>
          <span>{deliveryTx.loading ? "Confirming…" : "Confirm Delivery Handover (MetaMask)"}</span>
        </button>
      );
    }

    return null;
  };

  const getModalActionStatus = (escrow) => {
    if (!escrow) return null;
    return txStatus[`complete-onchain-${escrow.id}`] || txStatus[`delivery-${escrow.id}`] || null;
  };

  return (
    <div className="space-y-5">
      {/* ── Accepted Quotes Needing Escrow Initialization ───────────── */}
      {quotesNeedingEscrow.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between pb-1">
            <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
              <span>💼</span> Accepted Quotes Awaiting Smart Escrow
            </h3>
            <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
              {quotesNeedingEscrow.length} Action Required
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {quotesNeedingEscrow.map((quote) => {
              const key = `create-${quote.id}`;
              const tx = txStatus[key] || {};
              const acceptedBid = quote.bids?.find((b) => b.status === "accepted");
              const totalAmount = acceptedBid
                ? (parseFloat(acceptedBid.bid_amount) * parseFloat(quote.quantity)).toFixed(4)
                : null;

              return (
                <div
                  key={quote.id}
                  className="bg-emerald-50/40 border border-emerald-200 rounded-2xl p-4 shadow-2xs hover:border-emerald-300 transition-all space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="text-sm font-extrabold text-slate-900 truncate">
                        {quote.product_name}
                      </h4>
                      <p className="text-xs text-slate-600">
                        Buyer: <strong>{acceptedBid?.fpo_name || "Verified FPO"}</strong>
                      </p>
                    </div>
                    <span className="text-xs font-bold font-mono text-emerald-700 bg-white px-2 py-0.5 rounded-md border border-emerald-200">
                      {totalAmount} ETH
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-1 border-t border-emerald-100 text-xs">
                    <span className="text-slate-500 font-medium">
                      {quote.quantity} {quote.unit}
                    </span>

                    <button
                      type="button"
                      onClick={() => createEscrow(quote)}
                      disabled={tx.loading}
                      className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 shadow-xs flex items-center gap-1 cursor-pointer disabled:opacity-50 shrink-0"
                    >
                      <span>🔐</span>
                      <span>{tx.loading ? "Initializing…" : "Initialize Escrow"}</span>
                    </button>
                  </div>

                  {tx.success && (
                    <div className="p-2 rounded-lg bg-emerald-100 border border-emerald-200 text-xs font-semibold text-emerald-800">
                      {tx.success}
                    </div>
                  )}
                  {tx.error && (
                    <div className="p-2 rounded-lg bg-rose-100 border border-rose-200 text-xs font-semibold text-rose-800">
                      {tx.error}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Active Smart Contract Escrows ──────────────────────────── */}
      {escrows.length === 0 && quotesNeedingEscrow.length === 0 ? (
        <div className="py-12 text-center bg-slate-50/50 rounded-2xl border border-slate-100">
          <span className="text-4xl block mb-2">🔐</span>
          <p className="text-sm font-bold text-slate-800">No Escrow Transactions Yet</p>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            Once an FPO places a bid and you accept it, you can initialize a trustless Sepolia smart contract escrow payment right here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between pb-1">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Active Escrow Transactions ({escrows.length})
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {escrows.map((escrow) => {
              const isOnChain = Boolean(escrow.escrow_id);
              let requiredAction = null;
              if (escrow.status === "created" && !isOnChain) {
                requiredAction = "Complete Escrow on Sepolia";
              } else if (escrow.status === "funded") {
                requiredAction = "Confirm Handover Delivery";
              }

              return (
                <EscrowDealCard
                  key={escrow.id}
                  escrow={escrow}
                  partnerLabel="FPO Buyer"
                  partnerName={escrow.fpo_name}
                  requiredActionLabel={requiredAction}
                  onViewDeal={(esc) => setActiveModalEscrow(esc)}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* ── Escrow Deal Detail Modal ───────────────────────────────── */}
      {activeModalEscrow && (
        <EscrowDealModal
          isOpen={Boolean(activeModalEscrow)}
          onClose={() => setActiveModalEscrow(null)}
          escrow={activeModalEscrow}
          partnerLabel="FPO Buyer"
          partnerName={activeModalEscrow.fpo_name}
          actionButton={renderModalAction(activeModalEscrow)}
          actionStatus={getModalActionStatus(activeModalEscrow)}
        />
      )}
    </div>
  );
}
