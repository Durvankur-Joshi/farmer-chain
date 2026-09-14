/**
 * FpoRetailerEscrowPanel — FPO View, Wholesale Retailer Escrows (Phase 3: Assisted Mode)
 *
 * FPO → Retailer escrow lifecycle:
 *   1. createRetailerEscrow — FPO creates on-chain escrow for awarded retailer deal
 *   2. (Retailer deposits ETH — handled in RetailerEscrowPanel)
 *   3. confirmRetailerDelivery — FPO confirms lot handover to retailer
 *   4. (Retailer releases payment — handled in RetailerEscrowPanel)
 *
 * Commercial INR values are always primary.
 * ETH amounts are strictly testnet settlement — never shown as crop price.
 * After successful release: purchased quantity → retailer inventory; remaining → FPO inventory.
 */

import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { useRefresh, useRefreshSubscription } from "../../context/useRefresh";
import { useEscrowWorkflow } from "../../hooks/useEscrowWorkflow";
import { formatInr } from "../../utils/pricing";
import EscrowDealCard from "../common/EscrowDealCard";
import EscrowDealModal from "../common/EscrowDealModal";

const MODE_KEY = "farmerchain-workflow-mode";

export default function FpoRetailerEscrowPanel({ onEscrowUpdated }) {
  const { refresh } = useRefresh();
  const [escrows, setEscrows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [awardedQuotes, setAwardedQuotes] = useState([]);
  const [activeModalEscrow, setActiveModalEscrow] = useState(null);
  const [mode, setMode] = useState(() => localStorage.getItem(MODE_KEY) || "assisted");

  // ── Workflow hook ────────────────────────────────────────────────────
  const workflow = useEscrowWorkflow({
    mode,
    onSuccess: () => {
      if (onEscrowUpdated) onEscrowUpdated();
    },
    onRefresh: (domains) => {
      refresh(domains);
      Promise.all([fetchEscrows(), fetchAwardedQuotes()]);
    },
  });

  const handleModeChange = (m) => {
    setMode(m);
    localStorage.setItem(MODE_KEY, m);
  };

  // ── Data fetching ────────────────────────────────────────────────────
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

  useRefreshSubscription(["escrow", "deals", "quotes", "fpo", "retailer"], () => {
    fetchEscrows();
    fetchAwardedQuotes();
  });

  // ── Modal open/close ─────────────────────────────────────────────────
  const openModal = (escrow) => {
    workflow.reset();
    setActiveModalEscrow(escrow);
  };

  const closeModal = () => {
    workflow.reset();
    setActiveModalEscrow(null);
  };

  // ── Required action label ────────────────────────────────────────────
  const getRequiredAction = (escrow) => {
    if (escrow.status === "created") return "Awaiting Retailer Deposit";
    if (escrow.status === "funded") return "Confirm Lot Handover";
    return null;
  };

  // ── Workflow action for modal ────────────────────────────────────────
  const getModalAction = (escrow) => {
    if (!escrow) return null;
    if (escrow.status === "funded") {
      return () => workflow.runConfirmRetailerDelivery(escrow);
    }
    return null;
  };

  const getModalActionLabel = (escrow) => {
    if (!escrow) return "";
    if (escrow.status === "funded") return "Confirm Lot Handover";
    return "";
  };

  const getRetryData = () => {
    if (!activeModalEscrow || workflow.phase !== "backend_error") return null;
    const action = workflow.currentAction;
    if (action === "create_retailer_escrow") {
      return {
        endpoint: `/api/escrow/retailer/${activeModalEscrow.id}/created-onchain/`,
        data: { tx_hash: workflow.txHash, escrow_id: activeModalEscrow.escrow_id, contract_address: null },
      };
    }
    if (action === "confirm_retailer_delivery") {
      return {
        endpoint: `/api/escrow/retailer/${activeModalEscrow.id}/delivery-confirm/`,
        data: { tx_hash: workflow.txHash },
      };
    }
    return null;
  };

  // ── Loading skeleton ─────────────────────────────────────────────────
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

  const existingQuoteIds = escrows.map((e) => e.quote_id);
  const quotesNeedingEscrow = awardedQuotes.filter((q) => !existingQuoteIds.includes(q.id));

  const retryInfo = getRetryData();

  return (
    <div className="space-y-5">
      {/* ── Awarded Deals Awaiting Escrow Creation ──────────────────── */}
      {quotesNeedingEscrow.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between pb-1">
            <h3 className="text-xs font-bold uppercase tracking-wider text-purple-900 flex items-center gap-1.5">
              <span>🤝</span> Awarded Wholesale Deals Awaiting Escrow Creation
            </h3>
            <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-800">
              {quotesNeedingEscrow.length} Ready
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {quotesNeedingEscrow.map((quote) => {
              const acceptedBid = quote.bids?.find((b) => b.status === "accepted");
              // Commercial INR — from bid_amount if >= 1 (INR), else legacy ETH fallback label
              const bidAmountNum = parseFloat(acceptedBid?.bid_amount || 0);
              const qty = parseFloat(quote.quantity || 0);
              const isInr = bidAmountNum >= 1;
              const totalInrDisplay = isInr && bidAmountNum > 0 && qty > 0
                ? formatInr(Math.round(bidAmountNum * qty))
                : null;

              return (
                <div
                  key={quote.id}
                  className="bg-purple-50/40 border border-purple-200 rounded-2xl p-4 shadow-2xs hover:border-purple-300 transition-all space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="text-sm font-extrabold text-slate-900 truncate">
                        {quote.product_name}
                      </h4>
                      <p className="text-xs text-slate-600">
                        Retail Buyer:{" "}
                        <strong>{acceptedBid?.retailer_name || `Retailer #${acceptedBid?.retailer || ""}`}</strong>
                      </p>
                    </div>
                    {/* Commercial INR — never ETH as crop price */}
                    {totalInrDisplay && (
                      <span className="text-xs font-bold font-mono text-purple-700 bg-white px-2 py-0.5 rounded-md border border-purple-200 shrink-0">
                        {totalInrDisplay}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-1 border-t border-purple-100 text-xs">
                    <span className="text-slate-500 font-medium">
                      {quote.quantity} {quote.unit}
                    </span>

                    <button
                      type="button"
                      id={`fpo-create-retailer-escrow-${quote.id}`}
                      onClick={() => workflow.runCreateRetailerEscrow(quote)}
                      disabled={workflow.isLocked}
                      className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-white bg-purple-600 hover:bg-purple-500 shadow-xs flex items-center gap-1 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                    >
                      <span>🔐</span>
                      <span>
                        {workflow.isLocked && workflow.currentEscrow?.id === quote.id
                          ? "Initializing…"
                          : "Initialize Wholesale Escrow"}
                      </span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Active Wholesale Escrow List ─────────────────────────────── */}
      {escrows.length === 0 && quotesNeedingEscrow.length === 0 ? (
        <div className="py-12 text-center bg-slate-50/50 rounded-2xl border border-slate-100 space-y-2">
          <span className="text-4xl block mb-2">🏢</span>
          <p className="text-sm font-bold text-slate-800">No Retail Wholesale Escrows Active</p>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            When you accept retailer bids on wholesale market quotes, smart contract escrow transactions will be tracked here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between pb-1">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Active Wholesale Escrows ({escrows.length})
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {escrows.map((escrow) => (
              <EscrowDealCard
                key={escrow.id}
                escrow={escrow}
                partnerLabel="Retail Buyer"
                partnerName={escrow.retailer_name}
                requiredActionLabel={getRequiredAction(escrow)}
                actionLabel="View Transaction"
                onViewDeal={openModal}
                isRetailer={false}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Escrow Deal Detail Modal ──────────────────────────────────── */}
      {activeModalEscrow && (
        <EscrowDealModal
          isOpen={Boolean(activeModalEscrow)}
          onClose={closeModal}
          escrow={activeModalEscrow}
          partnerLabel="Retail Buyer"
          partnerName={activeModalEscrow.retailer_name}
          workflow={workflow}
          mode={mode}
          onModeChange={handleModeChange}
          onPrimaryAction={getModalAction(activeModalEscrow)}
          primaryActionLabel={getModalActionLabel(activeModalEscrow)}
          retryEndpoint={retryInfo?.endpoint}
          retryData={retryInfo?.data}
        />
      )}
    </div>
  );
}
