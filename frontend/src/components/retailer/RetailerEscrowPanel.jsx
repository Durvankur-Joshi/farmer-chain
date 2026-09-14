/**
 * RetailerEscrowPanel — Retailer View, Wholesale Procurement Escrows (Phase 3: Assisted Mode)
 *
 * Retailer escrow lifecycle:
 *   1. (FPO creates escrow — handled in FpoRetailerEscrowPanel)
 *   2. fundRetailerEscrow   — Retailer deposits ETH after FPO's on-chain registration
 *   3. (FPO confirms delivery — handled in FpoRetailerEscrowPanel)
 *   4. releaseRetailerPayment — Retailer releases ETH to FPO; purchased stock added to inventory
 *
 * Commercial INR values are always primary.
 * ETH amounts are strictly testnet settlement — never shown as crop price.
 * Provenance, crop passport, and farmer attribution are preserved after release.
 */

import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { useRefresh, useRefreshSubscription } from "../../context/useRefresh";
import { useEscrowWorkflow } from "../../hooks/useEscrowWorkflow";
import EscrowDealCard from "../common/EscrowDealCard";
import EscrowDealModal from "../common/EscrowDealModal";

const MODE_KEY = "farmerchain-workflow-mode";

export default function RetailerEscrowPanel({ onPaymentReleased, onEscrowUpdated }) {
  const { refresh } = useRefresh();
  const [escrows, setEscrows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeModalEscrow, setActiveModalEscrow] = useState(null);
  const [mode, setMode] = useState(() => localStorage.getItem(MODE_KEY) || "assisted");

  // ── Workflow hook ────────────────────────────────────────────────────
  const workflow = useEscrowWorkflow({
    mode,
    onSuccess: (txHash, data) => {
      if (onEscrowUpdated) onEscrowUpdated();
      // Notify parent of payment release (triggers inventory refresh)
      if (
        workflow.currentAction === "release_retailer_payment" &&
        onPaymentReleased
      ) {
        onPaymentReleased();
      }
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

  useRefreshSubscription(["escrow", "deals", "quotes", "retailer", "fpo"], fetchEscrows);

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
      return escrow.escrow_id ? "Lock ETH Funds in Escrow" : "Awaiting FPO Setup";
    }
    if (escrow.status === "funded") return "Awaiting Delivery Handover";
    if (escrow.status === "delivery_confirmed") return "Release Payment to FPO";
    return null;
  };

  // ── Workflow action for modal ────────────────────────────────────────
  const getModalAction = (escrow) => {
    if (!escrow) return null;
    if (escrow.status === "created" && escrow.escrow_id) {
      return () => workflow.runFundRetailerEscrow(escrow);
    }
    if (escrow.status === "delivery_confirmed") {
      return () => workflow.runReleaseRetailerPayment(escrow);
    }
    return null;
  };

  const getModalActionLabel = (escrow) => {
    if (!escrow) return "";
    if (escrow.status === "created" && escrow.escrow_id) return "Lock Funds in Escrow";
    if (escrow.status === "delivery_confirmed") return "Confirm Delivery & Release Payment";
    return "";
  };

  const getRetryData = () => {
    if (!activeModalEscrow || workflow.phase !== "backend_error") return null;
    const action = workflow.currentAction;
    if (action === "fund_retailer_escrow") {
      return {
        endpoint: `/api/escrow/retailer/${activeModalEscrow.id}/funded/`,
        data: { tx_hash: workflow.txHash, escrow_id: activeModalEscrow.escrow_id },
      };
    }
    if (action === "release_retailer_payment") {
      return {
        endpoint: `/api/escrow/retailer/${activeModalEscrow.id}/released/`,
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
        <span className="text-4xl block mb-2">🔐</span>
        <p className="text-sm font-bold text-slate-800">No Commercial Escrows Active</p>
        <p className="text-xs text-slate-400 max-w-sm mx-auto">
          When an FPO accepts your wholesale procurement bid, the on-chain escrow transaction will appear here for payment lock and release.
        </p>
      </div>
    );
  }

  const retryInfo = getRetryData();

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        {escrows.map((escrow) => (
          <EscrowDealCard
            key={escrow.id}
            escrow={escrow}
            partnerLabel="FPO Supplier"
            partnerName={escrow.fpo_name}
            requiredActionLabel={getRequiredAction(escrow)}
            actionLabel="View Transaction"
            onViewDeal={openModal}
            isRetailer={true}
          />
        ))}
      </div>

      {/* ── Escrow Deal Detail Modal ──────────────────────────────────── */}
      {activeModalEscrow && (
        <EscrowDealModal
          isOpen={Boolean(activeModalEscrow)}
          onClose={closeModal}
          escrow={activeModalEscrow}
          partnerLabel="FPO Supplier"
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
