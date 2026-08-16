import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { ethers } from "ethers";
import EscrowABI from "../../utils/EscrowABI.json";
import StatusBadge from "../common/StatusBadge";
import AddressCopy from "../common/AddressCopy";

const ESCROW_CONTRACT = import.meta.env.VITE_ESCROW_CONTRACT_ADDRESS;
const SEPOLIA_CHAIN_ID = "0xaa36a7"; // 11155111

const ESCROW_STEPS = [
  { key: "created", label: "Created", icon: "📝", desc: "FPO Initialized Escrow" },
  { key: "funded", label: "Funded", icon: "💰", desc: "Retailer Locked ETH" },
  { key: "delivery_confirmed", label: "Delivered", icon: "📦", desc: "FPO Dispatched Lot" },
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

function RetailerEscrowProgressStepper({ status }) {
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
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 sm:gap-2">
        {ESCROW_STEPS.map((step, idx) => {
          const isDone = currentIdx > idx || currentIdx === 3;
          const isCurrent = currentIdx === idx && currentIdx !== 3;

          let stepStyle = "bg-slate-50 border-slate-200 text-slate-400";
          let dotStyle = "bg-slate-200 text-slate-500";

          if (isDone) {
            stepStyle = "bg-emerald-50/60 border-emerald-300 text-emerald-800";
            dotStyle = "bg-emerald-600 text-white";
          } else if (isCurrent) {
            stepStyle = "bg-purple-50 border-purple-400 text-purple-900 ring-1 ring-purple-400 shadow-2xs";
            dotStyle = "bg-purple-600 text-white animate-pulse";
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

export default function RetailerEscrowPanel({ onPaymentReleased }) {
  const [escrows, setEscrows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [txStatus, setTxStatus] = useState({});

  const fetchEscrows = useCallback(async () => {
    try {
      const res = await axios.get("/api/escrow/retailer/my/", { withCredentials: true });
      setEscrows(res.data.escrows || []);
    } catch (err) {
      console.error("Error fetching retailer escrows:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEscrows();
  }, [fetchEscrows]);

  const ensureSepolia = async () => {
    if (!window.ethereum) throw new Error("MetaMask is required.");
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
    if (!ESCROW_CONTRACT) throw new Error("Escrow contract address is not configured.");
    await ensureSepolia();
    const provider = new ethers.providers.Web3Provider(window.ethereum);
    await provider.send("eth_requestAccounts", []);
    const signer = provider.getSigner();
    return new ethers.Contract(ESCROW_CONTRACT, EscrowABI, signer);
  };

  const setTx = (id, update) =>
    setTxStatus((prev) => ({ ...prev, [id]: { ...(prev[id] || {}), ...update } }));

  // ── Fund Escrow ─────────────────────────────────────────────────
  const handleFundEscrow = async (escrow) => {
    const key = `fund-${escrow.id}`;
    try {
      setTx(key, { loading: true, error: null, success: null });

      if (!escrow.escrow_id) {
        throw new Error("On-chain escrow ID missing. FPO must initialize the agreement first.");
      }

      const contract = await getContract();
      const amountWei = ethers.utils.parseEther(String(escrow.amount_eth));

      setTx(key, { loading: true, error: null, success: `Confirm ${escrow.amount_eth} ETH deposit in MetaMask…` });
      const tx = await contract.depositEscrow(escrow.escrow_id, { value: amountWei });
      setTx(key, { loading: true, error: null, success: `Deposit submitted (${tx.hash.slice(0, 10)}…). Waiting for confirmation…` });

      const receipt = await tx.wait(1);

      await axios.post(
        `/api/escrow/retailer/${escrow.id}/funded/`,
        {
          tx_hash: receipt.transactionHash,
          escrow_id: escrow.escrow_id,
        },
        { withCredentials: true }
      );

      setTx(key, { loading: false, error: null, success: `✅ ${escrow.amount_eth} ETH locked in Sepolia escrow! FPO will now dispatch the lot.` });
      fetchEscrows();
    } catch (err) {
      console.error("Fund escrow error:", err);
      const msg = err.response?.data?.error || err.message || "Failed to fund escrow.";
      setTx(key, { loading: false, error: msg, success: null });
    }
  };

  // ── Release Payment ─────────────────────────────────────────────
  const handleReleasePayment = async (escrow) => {
    const key = `release-${escrow.id}`;
    try {
      setTx(key, { loading: true, error: null, success: null });

      const contract = await getContract();
      setTx(key, { loading: true, error: null, success: "Confirm payment release in MetaMask…" });

      const tx = await contract.releasePayment(escrow.escrow_id);
      setTx(key, { loading: true, error: null, success: `Transaction submitted (${tx.hash.slice(0, 10)}…). Waiting for confirmation…` });

      const receipt = await tx.wait(1);

      await axios.post(
        `/api/escrow/retailer/${escrow.id}/released/`,
        { tx_hash: receipt.transactionHash },
        { withCredentials: true }
      );

      setTx(key, { loading: false, error: null, success: "✅ Payment released to FPO! Your purchased crop has been added to your Inventory." });
      fetchEscrows();
      if (onPaymentReleased) onPaymentReleased();
    } catch (err) {
      console.error("Release payment error:", err);
      const msg = err.response?.data?.error || err.message || "Failed to release payment.";
      setTx(key, { loading: false, error: msg, success: null });
    }
  };

  return (
    <div className="space-y-6">
      {loading ? (
        <div className="py-12 text-center text-xs text-slate-400 animate-pulse">
          Loading smart-contract escrow agreements…
        </div>
      ) : escrows.length === 0 ? (
        <div className="py-12 text-center bg-slate-50/50 rounded-3xl border border-slate-100 space-y-1.5">
          <span className="text-4xl block mb-2">🔐</span>
          <p className="text-sm font-bold text-slate-800">No Escrows Active Yet</p>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            When an FPO accepts your procurement bid and initializes the on-chain agreement, it will appear here for funding.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {escrows.map((escrow) => {
            const fundKey = `fund-${escrow.id}`;
            const releaseKey = `release-${escrow.id}`;
            const fundState = txStatus[fundKey] || {};
            const releaseState = txStatus[releaseKey] || {};

            return (
              <div
                key={escrow.id}
                className="bg-white border border-slate-200/90 rounded-3xl p-5 sm:p-6 space-y-4 shadow-2xs hover:border-purple-300 transition-all"
              >
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-base font-extrabold text-slate-900">
                      🌾 {escrow.product_name}
                    </span>
                    <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-md bg-purple-50 text-purple-800 border border-purple-200">
                      {escrow.escrow_id ? `On-Chain Escrow #${escrow.escrow_id}` : "Pending Initial Setup"}
                    </span>
                    <span className="text-xs font-mono text-slate-400">
                      Lot #{escrow.quote_id}
                    </span>
                  </div>
                  <StatusBadge status={escrow.status} />
                </div>

                {/* Progress Stepper */}
                <RetailerEscrowProgressStepper status={escrow.status} />

                {/* Details Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5 text-xs bg-slate-50/80 p-3.5 rounded-2xl border border-slate-100">
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Amount Due</span>
                    <span className="font-extrabold text-purple-900 font-mono text-sm mt-0.5 block">{escrow.amount_eth} ETH</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Lot Quantity</span>
                    <span className="font-semibold text-slate-800 mt-0.5 block">{escrow.quantity} {escrow.unit}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Seller (FPO)</span>
                    <span className="font-semibold text-slate-800 mt-0.5 block truncate">{escrow.fpo_name}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">FPO Wallet</span>
                    <AddressCopy value={escrow.fpo_wallet} etherscanType="address" />
                  </div>
                </div>

                {/* Multi-Farmer Provenance Breakdown */}
                {escrow.allocations && escrow.allocations.length > 0 && (
                  <div className="p-3 bg-purple-50/60 border border-purple-200/80 rounded-2xl space-y-1.5 text-xs">
                    <div className="flex items-center justify-between text-purple-950 font-extrabold text-[11px]">
                      <span>🔗 Verified Multi-Farmer Provenance ({escrow.allocations.length} Source Lots):</span>
                      <span>{new Set(escrow.allocations.map(a => a.farmer_name)).size} Farmers</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-[11px] text-slate-700">
                      {escrow.allocations.map((alloc) => (
                        <div key={alloc.id} className="bg-white p-2 rounded-xl border border-purple-100 flex items-center justify-between shadow-2xs">
                          <div>
                            <span className="font-bold text-slate-900">{alloc.farmer_name}</span>{" "}
                            {alloc.crop_passport_id ? (
                              <span className="text-emerald-700 font-semibold">(Passport #{alloc.crop_passport_id})</span>
                            ) : null}
                          </div>
                          <span className="font-mono font-bold text-purple-800">{alloc.allocated_quantity} {alloc.unit}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Transaction Hashes */}
                {(escrow.create_tx_hash || escrow.deposit_tx_hash || escrow.delivery_tx_hash || escrow.release_tx_hash) && (
                  <div className="flex flex-wrap items-center gap-3 text-xs pt-1 text-slate-500">
                    {escrow.create_tx_hash && (
                      <div className="flex items-center gap-1">
                        <span className="font-semibold text-slate-600">Created:</span>
                        <AddressCopy value={escrow.create_tx_hash} etherscanType="tx" />
                      </div>
                    )}
                    {escrow.deposit_tx_hash && (
                      <div className="flex items-center gap-1">
                        <span className="font-semibold text-slate-600">Funded:</span>
                        <AddressCopy value={escrow.deposit_tx_hash} etherscanType="tx" />
                      </div>
                    )}
                    {escrow.delivery_tx_hash && (
                      <div className="flex items-center gap-1">
                        <span className="font-semibold text-slate-600">Delivered:</span>
                        <AddressCopy value={escrow.delivery_tx_hash} etherscanType="tx" />
                      </div>
                    )}
                    {escrow.release_tx_hash && (
                      <div className="flex items-center gap-1">
                        <span className="font-semibold text-slate-600">Released:</span>
                        <AddressCopy value={escrow.release_tx_hash} etherscanType="tx" />
                      </div>
                    )}
                  </div>
                )}

                {/* Funding Action Row */}
                {escrow.status === "created" && (
                  <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <p className="text-xs text-slate-600">
                      Lock <strong>{escrow.amount_eth} ETH</strong> into the trustless Sepolia escrow contract to guarantee payment upon delivery.
                    </p>
                    <button
                      type="button"
                      onClick={() => handleFundEscrow(escrow)}
                      disabled={fundState.loading || !escrow.escrow_id}
                      className="px-4 py-2.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-xl transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 shrink-0"
                    >
                      <span>💰</span>
                      <span>{fundState.loading ? "Depositing…" : `Fund Escrow (${escrow.amount_eth} ETH)`}</span>
                    </button>
                  </div>
                )}

                {/* Release Payment Action Row */}
                {escrow.status === "delivery_confirmed" && (
                  <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <p className="text-xs text-slate-600">
                      FPO has confirmed delivery. Inspect the lot and release <strong>{escrow.amount_eth} ETH</strong> to the FPO's wallet.
                    </p>
                    <button
                      type="button"
                      onClick={() => handleReleasePayment(escrow)}
                      disabled={releaseState.loading}
                      className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 shrink-0"
                    >
                      <span>💸</span>
                      <span>{releaseState.loading ? "Releasing…" : "Release Payment to FPO"}</span>
                    </button>
                  </div>
                )}

                {fundState.error && (
                  <p className="text-xs text-rose-600 font-semibold">❌ {fundState.error}</p>
                )}
                {fundState.success && (
                  <p className="text-xs text-emerald-700 font-semibold">{fundState.success}</p>
                )}
                {releaseState.error && (
                  <p className="text-xs text-rose-600 font-semibold">❌ {releaseState.error}</p>
                )}
                {releaseState.success && (
                  <p className="text-xs text-emerald-700 font-semibold">{releaseState.success}</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
