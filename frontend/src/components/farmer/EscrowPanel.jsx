import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { ethers } from "ethers";
import EscrowABI from "../../utils/EscrowABI.json";
import StatusBadge from "../common/StatusBadge";
import AddressCopy from "../common/AddressCopy";

const ESCROW_CONTRACT = import.meta.env.VITE_ESCROW_CONTRACT_ADDRESS;
const SEPOLIA_CHAIN_ID = "0xaa36a7"; // 11155111 in hex

const ESCROW_STEPS = [
  { key: "created", label: "Created", icon: "📝", desc: "Contract Initialized" },
  { key: "funded", label: "Funded", icon: "💰", desc: "ETH Locked on Sepolia" },
  { key: "delivery_confirmed", label: "Delivered", icon: "📦", desc: "Farmer Handover Confirmed" },
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

function EscrowProgressStepper({ status }) {
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

export default function EscrowPanel() {
  const [escrows, setEscrows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [txStatus, setTxStatus] = useState({});

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

  // ── Helpers ─────────────────────────────────────────────────────

  const ensureSepolia = async () => {
    if (!window.ethereum) throw new Error("MetaMask is not installed.");
    const chainId = await window.ethereum.request({ method: "eth_chainId" });
    if (chainId !== SEPOLIA_CHAIN_ID) {
      try {
        await window.ethereum.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: SEPOLIA_CHAIN_ID }],
        });
      } catch {
        throw new Error("Please switch MetaMask to Sepolia Test Network.");
      }
    }
  };

  const getContract = async () => {
    if (!ESCROW_CONTRACT) throw new Error("Escrow contract address not configured.");
    await ensureSepolia();
    const provider = new ethers.providers.Web3Provider(window.ethereum);
    await provider.send("eth_requestAccounts", []);
    const signer = provider.getSigner();
    return new ethers.Contract(ESCROW_CONTRACT, EscrowABI, signer);
  };

  const setTx = (id, update) =>
    setTxStatus((prev) => ({ ...prev, [id]: { ...(prev[id] || {}), ...update } }));

  // ── Create Escrow ───────────────────────────────────────────────

  const createEscrow = async (quote) => {
    const key = `create-${quote.id}`;
    try {
      setTx(key, { loading: true, error: null, success: null });

      // Step 1: Create escrow record in backend
      const res = await axios.post(
        "/api/escrow/create/",
        { quote_id: quote.id },
        { withCredentials: true }
      );
      const escrowData = res.data.escrow;
      const amountWei = ethers.utils.parseEther(String(res.data.amount_eth));
      const fpoWallet = res.data.fpo_wallet;

      setTx(key, { loading: true, error: null, success: "Creating on-chain escrow via MetaMask..." });

      // Step 2: Create on-chain escrow via MetaMask
      const contract = await getContract();
      const tx = await contract.createEscrow(fpoWallet, amountWei, quote.id);

      setTx(key, { loading: true, success: "Waiting for blockchain confirmation..." });
      const receipt = await tx.wait();

      const event = receipt.events?.find((e) => e.event === "EscrowCreated");
      const onChainId = event ? event.args.escrowId.toNumber() : null;

      // Step 3: Record on-chain tx in backend
      await axios.post(
        `/api/escrow/${escrowData.id}/created-onchain/`,
        { tx_hash: receipt.transactionHash, escrow_id: onChainId },
        { withCredentials: true }
      );

      setTx(key, { loading: false, success: "Escrow created on Sepolia! ✅" });
      await Promise.all([fetchEscrows(), fetchAcceptedQuotes()]);
    } catch (err) {
      console.error("Create escrow error:", err);
      const msg =
        err.response?.data?.error ||
        err.reason ||
        err.message ||
        "Failed to create escrow.";
      setTx(key, { loading: false, error: msg });
    }
  };

  // ── Confirm Delivery ────────────────────────────────────────────

  const confirmDelivery = async (escrow) => {
    const key = `delivery-${escrow.id}`;
    try {
      setTx(key, { loading: true, error: null, success: null });

      if (!escrow.escrow_id) throw new Error("On-chain escrow ID missing.");

      const contract = await getContract();
      setTx(key, { loading: true, success: "Confirming delivery via MetaMask..." });

      const tx = await contract.confirmDelivery(escrow.escrow_id);
      setTx(key, { loading: true, success: "Waiting for blockchain confirmation..." });
      const receipt = await tx.wait();

      await axios.post(
        `/api/escrow/${escrow.id}/delivery-confirm/`,
        { tx_hash: receipt.transactionHash },
        { withCredentials: true }
      );

      setTx(key, { loading: false, success: "Delivery confirmed on-chain! ✅" });
      await fetchEscrows();
    } catch (err) {
      console.error("Confirm delivery error:", err);
      const msg =
        err.response?.data?.error ||
        err.reason ||
        err.message ||
        "Failed to confirm delivery.";
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

  const escrowQuoteIds = escrows.map((e) => e.quote_id);
  const quotesNeedingEscrow = acceptedQuotes.filter(
    (q) => !escrowQuoteIds.includes(q.id)
  );

  return (
    <div className="space-y-6">
      {/* ── Accepted Quotes Needing Escrow ─────────────────────── */}
      {quotesNeedingEscrow.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
              <span>💼</span> Accepted Quotes Awaiting Smart Escrow
            </h3>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
              {quotesNeedingEscrow.length} Action Required
            </span>
          </div>

          <div className="space-y-3">
            {quotesNeedingEscrow.map((quote) => {
              const key = `create-${quote.id}`;
              const tx = txStatus[key] || {};
              const acceptedBid = quote.bids?.find((b) => b.status === "accepted");
              const totalAmount = acceptedBid
                ? (parseFloat(acceptedBid.bid_amount) * parseFloat(quote.quantity)).toFixed(6)
                : null;

              return (
                <div
                  key={quote.id}
                  className="bg-gradient-to-r from-emerald-50/50 via-white to-emerald-50/30 border border-emerald-200 rounded-2xl p-5 shadow-2xs transition-all hover:border-emerald-300"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-slate-900">
                          {quote.product_name}
                        </span>
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800">
                          {quote.quantity} {quote.unit}
                        </span>
                      </div>
                      {acceptedBid && (
                        <div className="text-xs text-slate-600 space-y-0.5">
                          <p>Buyer FPO: <strong>{acceptedBid.fpo_name}</strong> · Rate: {acceptedBid.bid_amount} ETH/{quote.unit}</p>
                          <p className="font-extrabold text-emerald-800">Total Escrow Value: {totalAmount} ETH</p>
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => createEscrow(quote)}
                      disabled={tx.loading}
                      className={`px-4 py-2.5 rounded-xl text-xs font-bold text-white transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer shrink-0 ${
                        tx.loading
                          ? "bg-slate-400 cursor-not-allowed"
                          : "bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/20"
                      }`}
                    >
                      <span>🔐</span>
                      <span>{tx.loading ? "Initializing Escrow…" : "Create Smart Escrow"}</span>
                    </button>
                  </div>

                  {tx.success && (
                    <div className="p-2.5 mt-3 rounded-xl bg-emerald-100 border border-emerald-300 text-xs font-medium text-emerald-800 flex items-center gap-1.5">
                      <span>✅</span>
                      <span>{tx.success}</span>
                    </div>
                  )}
                  {tx.error && (
                    <div className="p-2.5 mt-3 rounded-xl bg-rose-100 border border-rose-300 text-xs font-medium text-rose-800 flex items-center gap-1.5">
                      <span>❌</span>
                      <span>{tx.error}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Active Escrows ─────────────────────────────────────── */}
      {escrows.length === 0 && quotesNeedingEscrow.length === 0 ? (
        <div className="py-12 text-center bg-slate-50/50 rounded-2xl border border-slate-100">
          <span className="text-4xl block mb-2">🔐</span>
          <p className="text-sm font-bold text-slate-800">No Escrow Transactions Yet</p>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            Once an FPO places a bid and you accept it, you can initialize a trustless Sepolia smart contract escrow payment right here.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between pb-1">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Active Smart Contract Escrows ({escrows.length})
            </h3>
          </div>

          {escrows.map((escrow) => {
            const key = `delivery-${escrow.id}`;
            const tx = txStatus[key] || {};
            return (
              <div
                key={escrow.id}
                className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs hover:border-slate-300 transition-all space-y-4"
              >
                {/* Top Title & Status */}
                <div className="flex justify-between items-start gap-2">
                  <div>
                    <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wider block">
                      Escrow #{escrow.escrow_id || escrow.id}
                    </span>
                    <h4 className="text-base font-extrabold text-slate-900">
                      {escrow.product_name}
                    </h4>
                  </div>
                  <StatusBadge status={escrow.status} />
                </div>

                {/* Visual Stepper */}
                <EscrowProgressStepper status={escrow.status} />

                {/* Details Metrics */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs bg-slate-50/70 p-3 rounded-xl border border-slate-100">
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">FPO Partner</span>
                    <span className="font-semibold text-slate-800 truncate block">{escrow.fpo_name}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Locked Amount</span>
                    <span className="font-bold text-amber-700 font-mono">{escrow.amount_eth} ETH</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Quantity</span>
                    <span className="font-medium text-slate-700">{escrow.quantity} {escrow.unit}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Initialized</span>
                    <span className="font-medium text-slate-700">{new Date(escrow.created_at).toLocaleDateString()}</span>
                  </div>
                </div>

                {/* Blockchain Proofs */}
                <div className="space-y-1 text-xs pt-1 border-t border-slate-100">
                  {escrow.contract_address && (
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                      <span className="text-slate-400 text-[11px]">Contract:</span>
                      <AddressCopy value={escrow.contract_address} etherscanType="address" />
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

                {/* Confirm Delivery button */}
                {escrow.status === "funded" && (
                  <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <p className="text-xs text-slate-500">
                      FPO has funded the escrow. Once the crop has been handed over, confirm delivery to allow payment release.
                    </p>
                    <button
                      type="button"
                      onClick={() => confirmDelivery(escrow)}
                      disabled={tx.loading}
                      className={`px-4 py-2 rounded-xl text-xs font-bold text-white transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer shrink-0 ${
                        tx.loading
                          ? "bg-slate-400 cursor-not-allowed"
                          : "bg-indigo-600 hover:bg-indigo-500 shadow-indigo-600/20"
                      }`}
                    >
                      <span>📦</span>
                      <span>{tx.loading ? "Confirming Delivery…" : "Confirm Delivery Handover"}</span>
                    </button>
                  </div>
                )}

                {tx.success && (
                  <div className="p-2.5 rounded-xl bg-emerald-100 border border-emerald-300 text-xs font-medium text-emerald-800">
                    ✅ {tx.success}
                  </div>
                )}
                {tx.error && (
                  <div className="p-2.5 rounded-xl bg-rose-100 border border-rose-300 text-xs font-medium text-rose-800">
                    ❌ {tx.error}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
