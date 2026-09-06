import React from "react";
import BaseModal from "./BaseModal";
import StatusBadge from "./StatusBadge";
import AddressCopy from "./AddressCopy";

const ESCROW_STEPS = [
  { key: "created", label: "Agreement", icon: "📝", desc: "Contract Created" },
  { key: "funded", label: "Payment", icon: "💰", desc: "Funds Secured in Escrow" },
  { key: "delivery_confirmed", label: "Delivery", icon: "📦", desc: "Handover Confirmed" },
  { key: "released", label: "Released", icon: "💸", desc: "Payment Settled" },
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

export default function EscrowDealModal({
  isOpen,
  onClose,
  escrow,
  partnerLabel = "Partner",
  partnerName,
  actionButton,
  actionStatus,
}) {
  if (!escrow) return null;

  const currentIdx = getStepIndex(escrow.status);
  const isOnChain = Boolean(escrow.escrow_id);

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title={escrow.product_name}
      subtitle={`${partnerLabel}: ${partnerName || escrow.fpo_name || escrow.farmer_name || "Verified Participant"}`}
      icon="🔐"
      badge={<StatusBadge status={escrow.status} />}
      maxWidth="max-w-2xl"
    >
      {/* ── 4-Step Lifecycle Stepper ───────────────────────────────── */}
      <div className="bg-slate-50/80 border border-slate-200/80 rounded-2xl p-3.5 sm:p-4">
        <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block mb-2">
          Escrow Settlement Lifecycle
        </span>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {ESCROW_STEPS.map((step, idx) => {
            const isDone = currentIdx > idx || currentIdx === 3;
            const isCurrent = currentIdx === idx && currentIdx !== 3;

            let stepStyle = "bg-white border-slate-200 text-slate-400";
            let dotStyle = "bg-slate-100 text-slate-400 border border-slate-200";

            if (isDone) {
              stepStyle = "bg-emerald-50/70 border-emerald-300 text-emerald-900";
              dotStyle = "bg-emerald-600 text-white";
            } else if (isCurrent) {
              stepStyle = "bg-blue-50 border-blue-400 text-blue-900 ring-1 ring-blue-400 shadow-2xs";
              dotStyle = "bg-blue-600 text-white animate-pulse";
            }

            return (
              <div
                key={step.key}
                className={`border rounded-xl p-2.5 text-center transition-all ${stepStyle}`}
              >
                <div className="flex items-center justify-center gap-1 mb-1">
                  <span className={`w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center ${dotStyle}`}>
                    {isDone ? "✓" : idx + 1}
                  </span>
                  <span className="text-sm">{step.icon}</span>
                </div>
                <p className="text-xs font-bold truncate">{step.label}</p>
                <p className="text-[10px] text-slate-500 hidden sm:block truncate mt-0.5">
                  {step.desc}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Deal Overview Grid ───────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
        <div className="bg-slate-50/70 p-3 rounded-xl border border-slate-100 min-w-0">
          <span className="text-[10px] text-slate-400 font-bold uppercase block truncate">Quantity</span>
          <span className="font-extrabold text-slate-900 font-mono mt-0.5 block truncate">
            {escrow.quantity} {escrow.unit}
          </span>
        </div>
        <div className="bg-slate-50/70 p-3 rounded-xl border border-slate-100 min-w-0">
          <span className="text-[10px] text-slate-400 font-bold uppercase block truncate">Total Locked Value</span>
          <span className="font-extrabold text-emerald-700 font-mono mt-0.5 block truncate">
            {escrow.amount_eth} ETH
          </span>
        </div>
        <div className="bg-slate-50/70 p-3 rounded-xl border border-slate-100 min-w-0">
          <span className="text-[10px] text-slate-400 font-bold uppercase block truncate">{partnerLabel}</span>
          <span className="font-semibold text-slate-800 mt-0.5 block truncate">
            {partnerName || escrow.fpo_name || escrow.farmer_name || "N/A"}
          </span>
        </div>
        <div className="bg-slate-50/70 p-3 rounded-xl border border-slate-100 min-w-0">
          <span className="text-[10px] text-slate-400 font-bold uppercase block truncate">Created Date</span>
          <span className="font-medium text-slate-700 mt-0.5 block truncate">
            {new Date(escrow.created_at || Date.now()).toLocaleDateString()}
          </span>
        </div>
      </div>

      {/* ── Primary Action Area & Feedback Alerts ─────────────────────── */}
      {actionButton && (
        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-0.5">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">
                Required Settlement Action
              </span>
              <p className="text-xs text-slate-600">
                Execute next smart contract transition on Ethereum Sepolia.
              </p>
            </div>
            {actionButton}
          </div>

          {actionStatus?.success && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-800 animate-fade-in flex items-center gap-2">
              <span>✅</span>
              <span>{actionStatus.success}</span>
            </div>
          )}

          {actionStatus?.error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-800 animate-fade-in flex items-center gap-2">
              <span>❌</span>
              <span>{actionStatus.error}</span>
            </div>
          )}
        </div>
      )}

      {/* ── Collapsible Blockchain Details Section ────────────────────── */}
      <details className="group border border-slate-200/80 rounded-2xl p-4 bg-slate-50/50 text-xs">
        <summary className="font-bold text-slate-700 cursor-pointer flex items-center justify-between select-none list-none">
          <div className="flex items-center gap-2">
            <span>⛓️</span>
            <span className="text-xs font-extrabold text-slate-800">Verification & Blockchain Details</span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200/60 text-slate-700">
              Sepolia 11155111
            </span>
          </div>
          <span className="text-xs text-slate-400 group-open:rotate-180 transition-transform font-bold">
            ▼
          </span>
        </summary>

        <div className="space-y-2.5 pt-3 mt-3 border-t border-slate-200/80">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
            <span className="text-slate-500 font-semibold text-[11px]">On-Chain Escrow ID:</span>
            <span className="font-mono font-bold text-slate-800">
              {isOnChain ? `#${escrow.escrow_id}` : "Pending on-chain registration"}
            </span>
          </div>

          {escrow.contract_address && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <span className="text-slate-500 font-semibold text-[11px]">Escrow Contract:</span>
              <AddressCopy value={escrow.contract_address} etherscanType="address" />
            </div>
          )}

          {escrow.create_tx_hash && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <span className="text-slate-500 font-semibold text-[11px]">Create Transaction:</span>
              <AddressCopy value={escrow.create_tx_hash} etherscanType="tx" />
            </div>
          )}

          {escrow.deposit_tx_hash && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <span className="text-slate-500 font-semibold text-[11px]">Deposit Transaction:</span>
              <AddressCopy value={escrow.deposit_tx_hash} etherscanType="tx" />
            </div>
          )}

          {escrow.release_tx_hash && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <span className="text-slate-500 font-semibold text-[11px]">Release Transaction:</span>
              <AddressCopy value={escrow.release_tx_hash} etherscanType="tx" />
            </div>
          )}
        </div>
      </details>
    </BaseModal>
  );
}
