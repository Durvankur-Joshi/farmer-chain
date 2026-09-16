/**
 * FpoEscrowPanel — FPO View, Farmer Procurement Escrows (Phase 6: Transaction UI)
 *
 * FPO escrow lifecycle (farmer procurement):
 *   1. (Farmer creates escrow — handled in EscrowPanel)
 *   2. fundEscrow    — FPO deposits ETH after farmer's on-chain registration
 *   3. (Farmer confirms delivery — handled in EscrowPanel)
 *   4. releasePayment — FPO releases ETH to farmer after delivery confirmed
 *
 * Commercial INR values are always primary.
 * ETH amounts are strictly testnet settlement — never shown as crop price.
 */

import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { useRefresh, useRefreshSubscription } from "../../context/useRefresh";
import { useEscrowWorkflow } from "../../hooks/useEscrowWorkflow";
import EscrowDealCard from "../common/EscrowDealCard";
import EscrowDealModal from "../common/EscrowDealModal";
import TransactionHistoryTable from "../common/TransactionHistoryTable";

const MODE_KEY = "farmerchain-workflow-mode";

export default function FpoEscrowPanel({ onEscrowUpdated }) {
  const { refresh } = useRefresh();
  const [escrows, setEscrows] = useState([]);
  const [loading, setLoading] = useState(true);
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
      fetchEscrows();
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
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEscrows();
  }, [fetchEscrows]);

  useRefreshSubscription(["escrow", "deals", "quotes", "fpo", "farmer"], fetchEscrows);

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
    if (escrow.status === "created") {
      return escrow.escrow_id ? "Deposit Funds (MetaMask)" : "Awaiting Farmer Setup";
    }
    if (escrow.status === "delivery_confirmed") return "Release Payment to Farmer";
    if (escrow.status === "funded") return "Awaiting Crop Handover";
    return null;
  };

  // ── Workflow action for modal ────────────────────────────────────────
  const getModalAction = (escrow) => {
    if (!escrow) return null;
    if (escrow.status === "created" && escrow.escrow_id) {
      return () => workflow.runFundEscrow(escrow);
    }
    if (escrow.status === "delivery_confirmed") {
      return () => workflow.runReleasePayment(escrow);
    }
    return null;
  };

  const getModalActionLabel = (escrow) => {
    if (!escrow) return "";
    if (escrow.status === "created" && escrow.escrow_id) return "Deposit Funds";
    if (escrow.status === "delivery_confirmed") return "Release Payment to Farmer";
    return "";
  };

  const getRetryData = () => {
    if (!activeModalEscrow || workflow.phase !== "backend_error") return null;
    const action = workflow.currentAction;
    if (action === "fund_escrow") {
      return {
        endpoint: `/api/escrow/${activeModalEscrow.id}/funded/`,
        data: { tx_hash: workflow.txHash, escrow_id: activeModalEscrow.escrow_id },
      };
    }
    if (action === "release_payment") {
      return {
        endpoint: `/api/escrow/${activeModalEscrow.id}/released/`,
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

  if (escrows.length === 0) {
    return (
      <div className="py-12 text-center bg-slate-50/50 rounded-2xl border border-slate-100 space-y-2">
        <span className="text-4xl block mb-2">🌾</span>
        <p className="text-sm font-bold text-slate-800">No Farmer Procurement Transactions Yet</p>
        <p className="text-xs text-slate-400 max-w-sm mx-auto">
          When farmers accept your bids on supply quotes, smart contract escrow transactions will appear here for funding and payment release.
        </p>
      </div>
    );
  }

  const retryInfo = getRetryData();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between pb-1 flex-wrap gap-2">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
          Farmer Procurement Transactions ({escrows.length})
        </h3>

        {/* View Switcher */}
        <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-xl text-xs">
          <button
            type="button"
            onClick={() => setViewMode("cards")}
            className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
              viewMode === "cards"
                ? "bg-white text-slate-900 shadow-2xs font-bold"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            ⊞ Cards
          </button>
          <button
            type="button"
            onClick={() => setViewMode("table")}
            className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
              viewMode === "table"
                ? "bg-white text-slate-900 shadow-2xs font-bold"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            ☰ Table
          </button>
        </div>
      </div>

      {viewMode === "cards" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {escrows.map((escrow) => (
            <EscrowDealCard
              key={escrow.id}
              escrow={escrow}
              partnerLabel="Purchased from"
              partnerName={escrow.farmer_name}
              requiredActionLabel={getRequiredAction(escrow)}
              actionLabel="View Transaction"
              onViewDeal={openModal}
            />
          ))}
        </div>
      ) : (
        <TransactionHistoryTable
          escrows={escrows}
          partnerLabel="Purchased from (Farmer)"
          onViewDeal={openModal}
          getRequiredAction={getRequiredAction}
          role="fpo"
        />
      )}

      {/* ── Escrow Deal Detail Modal ──────────────────────────────────── */}
      {activeModalEscrow && (
        <EscrowDealModal
          isOpen={Boolean(activeModalEscrow)}
          onClose={closeModal}
          escrow={activeModalEscrow}
          partnerLabel="Purchased from (Farmer)"
          partnerName={activeModalEscrow.farmer_name}
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
