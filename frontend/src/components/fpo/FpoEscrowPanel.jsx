import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { ethers } from "ethers";
import EscrowABI from "../../utils/EscrowABI.json";
import StatusBadge from "../common/StatusBadge";
import AddressCopy from "../common/AddressCopy";

const ESCROW_CONTRACT = import.meta.env.VITE_ESCROW_CONTRACT_ADDRESS;
const SEPOLIA_CHAIN_ID = "0xaa36a7"; // 11155111

const ESCROW_STEPS = [
  { key: "created", label: "Created", icon: "📝", desc: "Farmer Created Escrow" },
  { key: "funded", label: "Funded", icon: "💰", desc: "FPO Locked ETH" },
  { key: "delivery_confirmed", label: "Delivered", icon: "📦", desc: "Handover Confirmed" },
  { key: "released", label: "Released", icon: "💸", desc: "Payment Dispatched" },
];

function getStepIndex(status) {
  switch (status) {
    case "created": return 0;
    case "funded": return 1;
    case "delivery_confirmed": return 2;
    case "released": return 3;
    default: return -1;
  }
}

function FpoEscrowProgressStepper({ status }) {
  const currentIdx = getStepIndex(status);

  if (status === "cancelled" || status === "disputed") {
    return (
      <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
        <span>⚠️</span>
        <span>Escrow {status === "cancelled" ? "Cancelled" : "Disputed on-chain"}</span>
      </div>
    );
  }

  return (
    <div className="py-2">
      <div className="grid grid-cols-4 gap-1 sm:gap-2">
        {ESCROW_STEPS.map((step, idx) => {
          const isDone = currentIdx > idx || currentIdx === 3;
          const isCurrent = currentIdx === idx && currentIdx !== 3;

          let stepStyle = "bg-slate-50 border-slate-200 text-slate-400";
          let dotStyle = "bg-slate-200 text-slate-500";

          if (isDone) {
            stepStyle = "bg-emerald-50/60 border-emerald-300 text-emerald-800";
            dotStyle = "bg-emerald-600 text-white";
          } else if (isCurrent) {
            stepStyle = "bg-blue-50/80 border-blue-400 text-blue-900 ring-1 ring-blue-400 shadow-2xs";
            dotStyle = "bg-blue-600 text-white animate-pulse";
          }

          return (
            <div
              key={step.key}
              className={`border rounded-xl p-2 text-center transition-all ${stepStyle}`}
            >
              <div className="flex items-center justify-center gap-1 mb-0.5">
                <span className={`w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center ${dotStyle}`}>
                  {isDone ? "✓" : idx + 1}
                </span>
                <span className="text-xs">{step.icon}</span>
              </div>
              <p className="text-[11px] font-bold truncate">{step.label}</p>
              <p className="text-[9px] text-slate-400 hidden sm:block truncate mt-0.5">{step.desc}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function FpoEscrowPanel() {
  const [escrows, setEscrows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [txStatus, setTxStatus] = useState({});

  const fetchEscrows = useCallback(async () => {
    try {
      const res = await axios.get("/api/escrow/my/", { withCredentials: true });
      setEscrows(res.data.escrows || []);
    } catch (err) {
      console.error("Error fetching escrows:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEscrows();
  }, [fetchEscrows]);

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

  const getSignerAndContract = async () => {
    if (!ESCROW_CONTRACT) throw new Error("Escrow contract address not configured. Please set VITE_ESCROW_CONTRACT_ADDRESS.");
    await ensureSepolia();
    const provider = new ethers.providers.Web3Provider(window.ethereum);
    await provider.send("eth_requestAccounts", []);
    const signer = provider.getSigner();
    const contract = new ethers.Contract(ESCROW_CONTRACT, EscrowABI, signer);
    return { signer, contract };
  };

  const setTx = (id, update) =>
    setTxStatus((prev) => ({ ...prev, [id]: { ...(prev[id] || {}), ...update } }));

  // ── Fund Escrow ─────────────────────────────────────────────────

  const fundEscrow = async (escrow) => {
    const key = `fund-${escrow.id}`;
    try {
      setTx(key, { loading: true, error: null, success: null });

      if (!escrow.escrow_id) {
        throw new Error("Blockchain escrow not created yet. The farmer must complete the MetaMask escrow creation transaction.");
      }

      const amountNum = parseFloat(escrow.amount_eth);
      if (isNaN(amountNum) || amountNum <= 0) {
        throw new Error(`Invalid escrow amount: ${escrow.amount_eth} ETH.`);
      }
      if (amountNum > 100) {
        throw new Error(
          `Safety Warning: Escrow amount is ${amountNum} ETH, which exceeds normal testnet limits. ` +
          `Please check that the agreed bid was in ETH per unit.`
        );
      }

      const { signer, contract } = await getSignerAndContract();

      const signerAddr = await signer.getAddress();
      if (signerAddr.toLowerCase() !== escrow.fpo_wallet?.toLowerCase()) {
        throw new Error(
          `Wallet mismatch: Connected wallet is ${signerAddr}, but this escrow requires FPO wallet ${escrow.fpo_wallet}. ` +
          "Please switch to the correct account in MetaMask."
        );
      }

      const amountWei = ethers.utils.parseEther(String(escrow.amount_eth));

      setTx(key, { loading: true, success: `Sending deposit of ${escrow.amount_eth} ETH via MetaMask…` });
      const tx = await contract.depositEscrow(escrow.escrow_id, { value: amountWei });

      setTx(key, { loading: true, success: "Waiting for Sepolia blockchain confirmation…" });
      const receipt = await tx.wait();

      await axios.post(
        `/api/escrow/${escrow.id}/funded/`,
        { tx_hash: receipt.transactionHash, escrow_id: escrow.escrow_id },
        { withCredentials: true }
      );

      setTx(key, { loading: false, success: `Escrow #${escrow.escrow_id} funded with ${escrow.amount_eth} ETH on Sepolia! ✅` });
      await fetchEscrows();
    } catch (err) {
      console.error("Fund escrow error:", err);
      let msg = err.response?.data?.error || err.reason || err.message || "Failed to fund escrow.";
      if (err.code === 4001 || err.code === "ACTION_REJECTED") {
        msg = "Deposit transaction was rejected in MetaMask.";
      }
      setTx(key, { loading: false, error: msg });
    }
  };

  // ── Release Payment ─────────────────────────────────────────────

  const releasePayment = async (escrow) => {
    const key = `release-${escrow.id}`;
    try {
      setTx(key, { loading: true, error: null, success: null });

      if (!escrow.escrow_id) {
        throw new Error("On-chain escrow ID missing.");
      }

      const { signer, contract } = await getSignerAndContract();

      const signerAddr = await signer.getAddress();
      if (signerAddr.toLowerCase() !== escrow.fpo_wallet?.toLowerCase()) {
        throw new Error(
          `Wallet mismatch: Connected wallet is ${signerAddr}, but this escrow requires FPO wallet ${escrow.fpo_wallet}.`
        );
      }

      setTx(key, { loading: true, success: "Releasing funds via MetaMask…" });
      const tx = await contract.releasePayment(escrow.escrow_id);

      setTx(key, { loading: true, success: "Waiting for Sepolia blockchain confirmation…" });
      const receipt = await tx.wait();

      await axios.post(
        `/api/escrow/${escrow.id}/released/`,
        { tx_hash: receipt.transactionHash },
        { withCredentials: true }
      );

      setTx(key, { loading: false, success: "Payment released to Farmer on Sepolia! ✅" });
      await fetchEscrows();
    } catch (err) {
      console.error("Release payment error:", err);
      let msg = err.response?.data?.error || err.reason || err.message || "Failed to release payment.";
      if (err.code === 4001 || err.code === "ACTION_REJECTED") {
        msg = "Release transaction was rejected in MetaMask.";
      }
      setTx(key, { loading: false, error: msg });
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2].map((i) => (
          <div key={i} className="bg-slate-50 border border-slate-200/60 rounded-2xl p-5 animate-pulse space-y-3">
            <div className="h-4 bg-slate-200 rounded w-1/4"></div>
            <div className="h-10 bg-slate-200 rounded"></div>
            <div className="grid grid-cols-4 gap-2">
              <div className="h-8 bg-slate-200 rounded"></div>
              <div className="h-8 bg-slate-200 rounded"></div>
              <div className="h-8 bg-slate-200 rounded"></div>
              <div className="h-8 bg-slate-200 rounded"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (escrows.length === 0) {
    return (
      <div className="py-12 text-center bg-slate-50/50 rounded-2xl border border-slate-100">
        <span className="text-4xl block mb-2">🔐</span>
        <p className="text-sm font-bold text-slate-800">No Escrow Transactions Available</p>
        <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
          When farmers accept your bids and initialize escrows on Sepolia, they will appear here for payment deposit and release.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {escrows.map((escrow) => {
        const fundKey = `fund-${escrow.id}`;
        const releaseKey = `release-${escrow.id}`;
        const fundTx = txStatus[fundKey] || {};
        const releaseTx = txStatus[releaseKey] || {};
        const isOnChain = Boolean(escrow.escrow_id);

        return (
          <div
            key={escrow.id}
            className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs hover:border-slate-300 transition-all space-y-4"
          >
            {/* Header */}
            <div className="flex justify-between items-start gap-2">
              <div>
                <span className="text-[11px] font-bold text-blue-900 uppercase tracking-wider block">
                  {isOnChain ? `On-Chain Escrow #${escrow.escrow_id}` : `Draft Escrow Record #${escrow.id}`}
                </span>
                <h4 className="text-base font-extrabold text-slate-900">
                  {escrow.product_name}
                </h4>
              </div>
              <StatusBadge status={escrow.status} />
            </div>

            {/* Stepper */}
            <FpoEscrowProgressStepper status={escrow.status} />

            {/* Details Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs bg-slate-50/70 p-3 rounded-xl border border-slate-100">
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase block">Farmer Partner</span>
                <span className="font-semibold text-slate-800 truncate block">{escrow.farmer_name}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase block">Amount Due</span>
                <span className="font-bold text-blue-700 font-mono">{escrow.amount_eth} ETH</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase block">Quantity</span>
                <span className="font-medium text-slate-700">{escrow.quantity} {escrow.unit}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase block">Created</span>
                <span className="font-medium text-slate-700">{new Date(escrow.created_at).toLocaleDateString()}</span>
              </div>
            </div>

            {/* Blockchain Proofs */}
            {isOnChain && (
              <div className="space-y-1 text-xs pt-1 border-t border-slate-100">
                {escrow.contract_address && (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                    <span className="text-slate-400 text-[11px]">Contract:</span>
                    <AddressCopy value={escrow.contract_address} etherscanType="address" />
                  </div>
                )}
                {escrow.create_tx_hash && (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                    <span className="text-slate-400 text-[11px]">Create Tx:</span>
                    <AddressCopy value={escrow.create_tx_hash} etherscanType="tx" />
                  </div>
                )}
                {escrow.deposit_tx_hash && (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                    <span className="text-slate-400 text-[11px]">Deposit Tx:</span>
                    <AddressCopy value={escrow.deposit_tx_hash} etherscanType="tx" />
                  </div>
                )}
                {escrow.release_tx_hash && (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                    <span className="text-slate-400 text-[11px]">Release Tx:</span>
                    <AddressCopy value={escrow.release_tx_hash} etherscanType="tx" />
                  </div>
                )}
              </div>
            )}

            {/* Actions */}
            {escrow.status === "created" && (
              <div className="pt-2 border-t border-slate-100">
                {isOnChain ? (
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <p className="text-xs text-slate-500">
                      Farmer created on-chain Escrow #{escrow.escrow_id}. Deposit <strong>{escrow.amount_eth} ETH</strong> via MetaMask to lock payment on Sepolia.
                    </p>
                    <button
                      type="button"
                      onClick={() => fundEscrow(escrow)}
                      disabled={fundTx.loading}
                      className={`px-5 py-2.5 rounded-xl text-xs font-bold text-white transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer shrink-0 ${
                        fundTx.loading
                          ? "bg-slate-400 cursor-not-allowed"
                          : "bg-blue-600 hover:bg-blue-500 shadow-blue-600/20"
                      }`}
                    >
                      <span>💰</span>
                      <span>{fundTx.loading ? "Depositing ETH…" : `Deposit ${escrow.amount_eth} ETH into Escrow`}</span>
                    </button>
                  </div>
                ) : (
                  <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs font-medium text-amber-900 flex items-start gap-2.5">
                    <span className="text-base">⏳</span>
                    <div>
                      <p className="font-bold">Blockchain escrow not created yet.</p>
                      <p className="text-amber-700 mt-0.5">
                        The farmer must complete the MetaMask escrow creation transaction before you can deposit funds on Sepolia.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {fundTx.success && (
              <div className="p-2.5 rounded-xl bg-emerald-100 border border-emerald-300 text-xs font-medium text-emerald-800">
                ✅ {fundTx.success}
              </div>
            )}
            {fundTx.error && (
              <div className="p-2.5 rounded-xl bg-rose-100 border border-rose-300 text-xs font-medium text-rose-800">
                ❌ {fundTx.error}
              </div>
            )}

            {escrow.status === "delivery_confirmed" && (
              <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <p className="text-xs text-slate-500">
                  Farmer has confirmed crop handover. Authorize payment release to dispatch ETH from the smart contract.
                </p>
                <button
                  type="button"
                  onClick={() => releasePayment(escrow)}
                  disabled={releaseTx.loading}
                  className={`px-5 py-2.5 rounded-xl text-xs font-bold text-white transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer shrink-0 ${
                    releaseTx.loading
                      ? "bg-slate-400 cursor-not-allowed"
                      : "bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/20"
                  }`}
                >
                  <span>💸</span>
                  <span>{releaseTx.loading ? "Releasing Payment…" : "Release Payment to Farmer"}</span>
                </button>
              </div>
            )}

            {releaseTx.success && (
              <div className="p-2.5 rounded-xl bg-emerald-100 border border-emerald-300 text-xs font-medium text-emerald-800">
                ✅ {releaseTx.success}
              </div>
            )}
            {releaseTx.error && (
              <div className="p-2.5 rounded-xl bg-rose-100 border border-rose-300 text-xs font-medium text-rose-800">
                ❌ {releaseTx.error}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
