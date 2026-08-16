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

export default function FpoRetailerEscrowPanel() {
  const [escrows, setEscrows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [txStatus, setTxStatus] = useState({});
  const [awardedQuotes, setAwardedQuotes] = useState([]);

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

  const fetchAwardedQuotes = useCallback(async () => {
    try {
      const res = await axios.get("/api/fpo/quotes/", { withCredentials: true });
      const quotes = res.data || [];
      const awarded = quotes.filter(
        (q) => (q.status === "awarded" || !!q.accepted_bid) && !q.escrow
      );
      setAwardedQuotes(awarded);
    } catch (err) {
      console.error("Error fetching awarded FPO quotes:", err);
    }
  }, []);

  useEffect(() => {
    fetchEscrows();
    fetchAwardedQuotes();
  }, [fetchEscrows, fetchAwardedQuotes]);

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

  // Helper to extract escrow ID from transaction receipt
  const extractEscrowId = (receipt, fallbackQuoteId) => {
    if (!receipt) return fallbackQuoteId || 1;
    if (receipt.events && receipt.events.length > 0) {
      for (const event of receipt.events) {
        if (event.event === "EscrowCreated" && event.args) {
          const id = event.args.escrowId ?? event.args[0];
          if (id !== undefined && id !== null) {
            return id.toNumber ? id.toNumber() : parseInt(id.toString(), 10);
          }
        }
      }
    }
    if (receipt.logs && receipt.logs.length > 0) {
      const iface = new ethers.utils.Interface(EscrowABI);
      for (const log of receipt.logs) {
        if (!log.address || log.address.toLowerCase() === ESCROW_CONTRACT?.toLowerCase()) {
          try {
            const parsed = iface.parseLog(log);
            if (parsed && (parsed.name === "EscrowCreated" || parsed.event === "EscrowCreated")) {
              const id = parsed.args?.escrowId ?? parsed.args?.[0];
              if (id !== undefined && id !== null) {
                return id.toNumber ? id.toNumber() : parseInt(id.toString(), 10);
              }
            }
          } catch {}
        }
      }
    }
    return fallbackQuoteId || 1;
  };

  // ── Create Escrow ───────────────────────────────────────────────
  const handleCreateEscrow = async (quote) => {
    const key = `create-${quote.id}`;
    try {
      setTx(key, { loading: true, error: null, success: null });

      let escrowData = null;
      let amountEth = null;
      let retailerWallet = null;

      try {
        const res = await axios.post(
          "/api/escrow/retailer/create/",
          { quote_id: quote.id, contract_address: ESCROW_CONTRACT },
          { withCredentials: true }
        );
        escrowData = res.data.escrow;
        amountEth = res.data.amount_eth;
        retailerWallet = res.data.retailer_wallet;
      } catch (postErr) {
        if (postErr.response?.status === 409 && postErr.response?.data?.escrow) {
          escrowData = postErr.response.data.escrow;
          amountEth = escrowData.amount_eth;
          retailerWallet = escrowData.retailer_wallet;
        } else {
          throw postErr;
        }
      }

      if (!escrowData) throw new Error("Could not initialize escrow record in database.");

      const contract = await getContract();
      const amountWei = ethers.utils.parseEther(String(amountEth));

      setTx(key, { loading: true, error: null, success: "Confirm transaction in MetaMask…" });
      const tx = await contract.createEscrow(retailerWallet, amountWei, quote.id);
      setTx(key, { loading: true, error: null, success: `Transaction submitted (${tx.hash.slice(0, 10)}…). Waiting for confirmation…` });

      const receipt = await tx.wait(1);
      const onChainEscrowId = extractEscrowId(receipt, quote.id);

      await axios.post(
        `/api/escrow/retailer/${escrowData.id}/created-onchain/`,
        {
          tx_hash: receipt.transactionHash,
          escrow_id: onChainEscrowId,
          contract_address: ESCROW_CONTRACT,
        },
        { withCredentials: true }
      );

      setTx(key, {
        loading: false,
        error: null,
        success: `✅ Escrow #${onChainEscrowId} created on Sepolia! Retailer can now lock funds.`,
      });

      fetchEscrows();
      fetchAwardedQuotes();
    } catch (err) {
      console.error("Create escrow error:", err);
      const msg = err.response?.data?.error || err.message || "Failed to create escrow.";
      setTx(key, { loading: false, error: msg, success: null });
    }
  };

  // ── Confirm Delivery ────────────────────────────────────────────
  const handleConfirmDelivery = async (escrow) => {
    const key = `deliver-${escrow.id}`;
    try {
      setTx(key, { loading: true, error: null, success: null });

      const contract = await getContract();
      setTx(key, { loading: true, error: null, success: "Confirm delivery in MetaMask…" });

      const tx = await contract.confirmDelivery(escrow.escrow_id);
      setTx(key, { loading: true, error: null, success: `Transaction submitted (${tx.hash.slice(0, 10)}…). Waiting for confirmation…` });

      const receipt = await tx.wait(1);

      await axios.post(
        `/api/escrow/retailer/${escrow.id}/delivery-confirm/`,
        { tx_hash: receipt.transactionHash },
        { withCredentials: true }
      );

      setTx(key, { loading: false, error: null, success: "✅ Delivery confirmed on Sepolia! Retailer can now release payment." });
      fetchEscrows();
    } catch (err) {
      console.error("Confirm delivery error:", err);
      const msg = err.response?.data?.error || err.message || "Failed to confirm delivery.";
      setTx(key, { loading: false, error: msg, success: null });
    }
  };

  return (
    <div className="space-y-6">
      {/* ── Pending Awarded Deals awaiting Escrow Creation ───────────── */}
      {awardedQuotes.length > 0 && (
        <div className="bg-purple-50/50 border border-purple-200 rounded-3xl p-5 sm:p-6 space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-xl">🤝</span>
            <div>
              <h3 className="text-sm font-extrabold text-purple-950">
                Awarded Deals Awaiting Escrow Creation
              </h3>
              <p className="text-xs text-slate-500">
                Initialize trustless smart-contract agreements on Ethereum Sepolia for accepted commercial retail bids.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {awardedQuotes.map((quote) => {
              const key = `create-${quote.id}`;
              const state = txStatus[key] || {};
              const bid = quote.accepted_bid;

              return (
                <div
                  key={quote.id}
                  className="bg-white border border-purple-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-2xs"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-slate-900">
                        {quote.product_name}
                      </span>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-purple-100 text-purple-800">
                        {quote.category}
                      </span>
                      <span className="text-xs font-mono text-slate-400">
                        Lot #{quote.id}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500">
                      Quantity: <strong>{quote.quantity} {quote.unit}</strong> · Buyer: <strong>{bid?.retailer_name || "Retail Buyer"}</strong> · Agreed Rate: <strong>{bid?.bid_amount} ETH / {quote.unit}</strong>
                    </p>
                    {state.error && (
                      <p className="text-xs text-rose-600 font-semibold mt-1">
                        ❌ {state.error}
                      </p>
                    )}
                    {state.success && (
                      <p className="text-xs text-emerald-700 font-semibold mt-1">
                        {state.success}
                      </p>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => handleCreateEscrow(quote)}
                    disabled={state.loading}
                    className="px-4 py-2.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-xl transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 shrink-0"
                  >
                    <span>📝</span>
                    <span>{state.loading ? "Initializing…" : "Create On-Chain Escrow"}</span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Active Escrow Agreements List ──────────────────────────── */}
      {loading ? (
        <div className="py-12 text-center text-xs text-slate-400 animate-pulse">
          Loading smart-contract escrow transactions…
        </div>
      ) : escrows.length === 0 ? (
        <div className="py-12 text-center bg-slate-50/50 rounded-3xl border border-slate-100 space-y-1.5">
          <span className="text-4xl block mb-2">🔐</span>
          <p className="text-sm font-bold text-slate-800">No Retailer Escrows Active</p>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            When you accept procurement bids from verified commercial retailers, on-chain escrow agreements will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {escrows.map((escrow) => {
            const deliverKey = `deliver-${escrow.id}`;
            const deliverState = txStatus[deliverKey] || {};

            return (
              <div
                key={escrow.id}
                className="bg-white border border-slate-200/90 rounded-3xl p-5 sm:p-6 space-y-4 shadow-2xs hover:border-purple-300 transition-all"
              >
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-base font-extrabold text-slate-900">
                      🏢 {escrow.product_name}
                    </span>
                    <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-md bg-purple-50 text-purple-800 border border-purple-200">
                      {escrow.escrow_id ? `On-Chain Escrow #${escrow.escrow_id}` : "Pending Sepolia ID"}
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
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Escrow Amount</span>
                    <span className="font-extrabold text-purple-900 font-mono text-sm mt-0.5 block">{escrow.amount_eth} ETH</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Lot Quantity</span>
                    <span className="font-semibold text-slate-800 mt-0.5 block">{escrow.quantity} {escrow.unit}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Buyer (Retailer)</span>
                    <span className="font-semibold text-slate-800 mt-0.5 block truncate">{escrow.retailer_name}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Buyer Wallet</span>
                    <AddressCopy value={escrow.retailer_wallet} etherscanType="address" />
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

                {/* Transaction Links */}
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

                {/* Action Row */}
                {escrow.status === "funded" && (
                  <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <p className="text-xs text-slate-600">
                      Retailer has locked <strong>{escrow.amount_eth} ETH</strong> in escrow. Confirm delivery once the bulk lot has been handed over.
                    </p>
                    <button
                      type="button"
                      onClick={() => handleConfirmDelivery(escrow)}
                      disabled={deliverState.loading}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 shrink-0"
                    >
                      <span>📦</span>
                      <span>{deliverState.loading ? "Confirming…" : "Confirm Delivery (FPO)"}</span>
                    </button>
                  </div>
                )}

                {deliverState.error && (
                  <p className="text-xs text-rose-600 font-semibold">❌ {deliverState.error}</p>
                )}
                {deliverState.success && (
                  <p className="text-xs text-emerald-700 font-semibold">{deliverState.success}</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
