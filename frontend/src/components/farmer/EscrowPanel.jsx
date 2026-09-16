/**
 * EscrowPanel — Farmer View (Phase 6: Transaction UI)
 *
 * Farmer escrow lifecycle:
 *   1. createEscrow  — farmer registers agreement on-chain
 *   2. (FPO deposits ETH — handled in FpoEscrowPanel)
 *   3. confirmDelivery — farmer confirms crop handover
 *   4. (FPO releases payment — handled in FpoEscrowPanel)
 *
 * Commercial INR values are always primary.
 * ETH amounts are strictly testnet settlement — never shown as crop price.
 * Zero emojis — clean shadcn/ui and Lucide icons throughout.
 */

import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { useRefresh, useRefreshSubscription } from "../../context/useRefresh";
import { useEscrowWorkflow } from "../../hooks/useEscrowWorkflow";
import { formatInr } from "../../utils/pricing";
import EscrowDealCard from "../common/EscrowDealCard";
import EscrowDealModal from "../common/EscrowDealModal";
import TransactionHistoryTable from "../common/TransactionHistoryTable";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ShieldCheck,
  Briefcase,
  LayoutGrid,
  Table as TableIcon,
  Lock,
  ArrowRight,
  Package,
  Building2,
  Loader2,
} from "lucide-react";

// Mode preference key in localStorage
const MODE_KEY = "farmerchain-workflow-mode";

export default function EscrowPanel({ onEscrowUpdated }) {
  const { refresh } = useRefresh();
  const [escrows, setEscrows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [acceptedQuotes, setAcceptedQuotes] = useState([]);
  const [activeModalEscrow, setActiveModalEscrow] = useState(null);
  const [mode, setMode] = useState(() => localStorage.getItem(MODE_KEY) || "assisted");
  const [viewMode, setViewMode] = useState("cards");

  // ── Workflow hook ────────────────────────────────────────────────────
  const workflow = useEscrowWorkflow({
    mode,
    onSuccess: () => {
      if (onEscrowUpdated) onEscrowUpdated();
    },
    onRefresh: (domains) => {
      refresh(domains);
      Promise.all([fetchEscrows(), fetchAcceptedQuotes()]);
    },
  });

  const handleModeChange = (m) => {
    setMode(m);
    localStorage.setItem(MODE_KEY, m);
  };

  // ── Data fetching ────────────────────────────────────────────────────
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

  // ── Modal open/close ─────────────────────────────────────────────────
  const openModal = (escrow) => {
    workflow.reset();
    setActiveModalEscrow(escrow);
  };

  const closeModal = () => {
    workflow.reset();
    setActiveModalEscrow(null);
  };

  // ── Pending recovery check ───────────────────────────────────────────
  const getPendingHint = (escrow) => {
    const rec = workflow.getPendingRecovery(escrow.id);
    if (!rec?.txHash) return null;
    return rec;
  };

  // ── Determine next action for escrow ─────────────────────────────────
  const getRequiredAction = (escrow) => {
    if (escrow.status === "created" && !escrow.escrow_id) return "Complete On-Chain Setup";
    if (escrow.status === "funded") return "Confirm Handover";
    return null;
  };

  // ── Workflow action for active modal escrow ──────────────────────────
  const getModalAction = (escrow) => {
    if (!escrow) return null;

    if (escrow.status === "created" && !escrow.escrow_id) {
      return () => workflow.runCompleteOnchain(escrow);
    }
    if (escrow.status === "funded") {
      return () => workflow.runConfirmDelivery(escrow);
    }
    return null;
  };

  const getModalActionLabel = (escrow) => {
    if (!escrow) return "";
    if (escrow.status === "created" && !escrow.escrow_id) return "Complete Setup";
    if (escrow.status === "funded") return "Confirm Handover";
    return "";
  };

  const getRetryData = () => {
    if (!activeModalEscrow || workflow.phase !== "backend_error") return null;
    const action = workflow.currentAction;
    if (action === "create_escrow" || action === "complete_onchain") {
      return {
        endpoint: `/api/escrow/${activeModalEscrow.id}/created-onchain/`,
        data: { tx_hash: workflow.txHash, escrow_id: activeModalEscrow.escrow_id, contract_address: null },
      };
    }
    if (action === "confirm_delivery") {
      return {
        endpoint: `/api/escrow/${activeModalEscrow.id}/delivery-confirm/`,
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
          <div key={i} className="border border-slate-200/80 rounded-2xl p-5 space-y-3">
            <Skeleton className="h-5 w-1/3" />
            <Skeleton className="h-16 w-full rounded-xl" />
            <div className="flex justify-between items-center pt-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-28 rounded-lg" />
            </div>
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

  const retryInfo = getRetryData();

  return (
    <div className="space-y-5">
      {/* ── Accepted Quotes Awaiting Escrow Init ─────────────────────── */}
      {quotesNeedingEscrow.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between pb-1 flex-wrap gap-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
              <Briefcase className="h-4 w-4 text-emerald-600" />
              <span>Accepted Deals Awaiting Payment Setup</span>
            </h3>
            <Badge variant="success" className="text-xs">
              {quotesNeedingEscrow.length} Action Required
            </Badge>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {quotesNeedingEscrow.map((quote) => {
              const acceptedBid = quote.bids?.find((b) => b.status === "accepted");
              const bidAmountNum = parseFloat(acceptedBid?.bid_amount || 0);
              const qty = parseFloat(quote.quantity || 0);
              const isInr = bidAmountNum >= 1;
              const totalInrDisplay =
                isInr && bidAmountNum > 0 && qty > 0
                  ? formatInr(Math.round(bidAmountNum * qty))
                  : null;

              return (
                <Card
                  key={quote.id}
                  className="bg-emerald-50/40 border-emerald-200 shadow-2xs hover:border-emerald-300 transition-all p-4 space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h4 className="text-sm font-bold text-slate-900 truncate">
                        {quote.product_name}
                      </h4>
                      <p className="text-xs text-slate-600 flex items-center gap-1 mt-0.5">
                        <Building2 className="h-3 w-3 text-slate-400 shrink-0" />
                        <span>Buyer:</span>
                        <span className="font-semibold text-slate-800 truncate">
                          {acceptedBid?.fpo_name || "Verified FPO"}
                        </span>
                      </p>
                    </div>
                    {/* Commercial INR value — NOT ETH */}
                    {totalInrDisplay && (
                      <span className="text-xs font-bold font-mono text-emerald-800 bg-white px-2.5 py-1 rounded-lg border border-emerald-200 shrink-0">
                        {totalInrDisplay}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-emerald-100 text-xs">
                    <span className="text-slate-600 font-medium">
                      {quote.quantity} {quote.unit}
                    </span>

                    <Button
                      type="button"
                      size="sm"
                      id={`farmer-create-escrow-${quote.id}`}
                      onClick={() => workflow.runCreateEscrow(quote)}
                      disabled={workflow.isLocked}
                      className="h-7 text-xs font-bold gap-1 bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer disabled:opacity-50"
                    >
                      {workflow.isLocked && workflow.currentEscrow?.id === quote.id ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          <span>Working…</span>
                        </>
                      ) : (
                        <>
                          <ShieldCheck className="h-3.5 w-3.5" />
                          <span>Secure Payment</span>
                        </>
                      )}
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Active Escrows ───────────────────────────────────────────── */}
      {escrows.length === 0 && quotesNeedingEscrow.length === 0 ? (
        <Card className="py-12 text-center bg-slate-50/50 border-dashed">
          <CardContent className="space-y-3">
            <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-800">No Transactions Yet</h4>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Once an FPO buyer accepts an offer and payment is initialized, your commercial transactions and handover records will appear here.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between pb-1 flex-wrap gap-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Secured Transactions ({escrows.length})
            </h3>

            {/* View Switcher: Cards vs Table */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200/80">
              <button
                type="button"
                onClick={() => setViewMode("cards")}
                className={`p-1.5 rounded-md transition-all cursor-pointer flex items-center gap-1 text-xs font-semibold ${
                  viewMode === "cards"
                    ? "bg-white text-emerald-700 shadow-2xs font-bold"
                    : "text-slate-500 hover:text-slate-900"
                }`}
                title="Cards View"
                aria-label="Cards View"
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Cards</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode("table")}
                className={`p-1.5 rounded-md transition-all cursor-pointer flex items-center gap-1 text-xs font-semibold ${
                  viewMode === "table"
                    ? "bg-white text-emerald-700 shadow-2xs font-bold"
                    : "text-slate-500 hover:text-slate-900"
                }`}
                title="Table View"
                aria-label="Table View"
              >
                <TableIcon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Table</span>
              </button>
            </div>
          </div>

          {viewMode === "cards" ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {escrows.map((escrow) => {
                const pending = getPendingHint(escrow);
                const requiredAction = getRequiredAction(escrow);

                return (
                  <div key={escrow.id}>
                    <EscrowDealCard
                      escrow={escrow}
                      partnerLabel="Sold to"
                      partnerName={escrow.fpo_name}
                      requiredActionLabel={pending?.txHash ? "Pending Sync" : requiredAction}
                      actionLabel="View Details"
                      onViewDeal={openModal}
                    />
                  </div>
                );
              })}
            </div>
          ) : (
            <TransactionHistoryTable
              escrows={escrows}
              partnerLabel="Sold to"
              onViewDeal={openModal}
              getRequiredAction={getRequiredAction}
              role="farmer"
            />
          )}
        </div>
      )}

      {/* ── Escrow Deal Detail Modal ──────────────────────────────────── */}
      {activeModalEscrow && (
        <EscrowDealModal
          isOpen={Boolean(activeModalEscrow)}
          onClose={closeModal}
          escrow={activeModalEscrow}
          partnerLabel="Sold to (FPO)"
          partnerName={activeModalEscrow.fpo_name}
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
