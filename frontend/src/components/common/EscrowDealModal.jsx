import React from "react";
import StatusBadge from "./StatusBadge";
import WorkflowStatusPanel from "./WorkflowStatusPanel";
import BlockchainDetailsCollapse from "./BlockchainDetailsCollapse";
import { formatInr } from "../../utils/pricing";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  FileText,
  IndianRupee,
  Truck,
  CheckCircle2,
  AlertCircle,
  Clock,
  ShieldCheck,
  Package,
  Building2,
} from "lucide-react";

const ESCROW_STEPS = [
  { key: "created", label: "Agreement", icon: FileText, desc: "Contract Created" },
  { key: "funded", label: "Payment", icon: IndianRupee, desc: "Funds Secured" },
  { key: "delivery_confirmed", label: "Delivery", icon: Truck, desc: "Handover Confirmed" },
  { key: "released", label: "Completed", icon: CheckCircle2, desc: "Payment Settled" },
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

/**
 * EscrowDealModal — Modern shadcn Dialog for Commercial Transaction Details
 *
 * Strict information hierarchy:
 *  1. Primary: Commercial ₹ value, crop, quantity, unit rate, counterparty, date, status badge.
 *  2. Secondary: Deal details and lifecycle progress stepper.
 *  3. Action: MetaMask Assisted/Manual Mode workflow.
 *  4. Tertiary: Expandable Blockchain Details (collapsed by default).
 *  Zero emojis — replaced with Lucide icons.
 */
export default function EscrowDealModal({
  isOpen,
  onClose,
  escrow,
  partnerLabel = "Partner",
  partnerName,
  // Phase 3 workflow props
  workflow,
  mode,
  onModeChange,
  onPrimaryAction,
  primaryActionLabel,
  retryEndpoint,
  retryData,
  // Backward compatibility fallback
  actionButton,
  actionStatus,
}) {
  if (!escrow) return null;

  const currentIdx = getStepIndex(escrow.status);
  const isOnChain = Boolean(escrow.escrow_id);

  // Derive primary commercial values
  const qty = parseFloat(escrow.quantity) || 0;
  const commercialInr =
    escrow.agreed_price_inr != null
      ? parseFloat(escrow.agreed_price_inr)
      : escrow.total_amount_inr != null
      ? parseFloat(escrow.total_amount_inr)
      : escrow.amount_inr != null
      ? parseFloat(escrow.amount_inr)
      : null;

  const inrDisplay = commercialInr != null ? formatInr(commercialInr) : "—";

  const unitRate =
    escrow.unit_price_inr != null
      ? parseFloat(escrow.unit_price_inr)
      : qty > 0 && commercialInr != null
      ? commercialInr / qty
      : null;

  const unitPriceDisplay = unitRate != null ? `${formatInr(Math.round(unitRate))} / ${escrow.unit}` : "—";

  const resolvedPartner =
    partnerName ||
    escrow.retailer_name ||
    escrow.fpo_name ||
    escrow.farmer_name ||
    "Verified Participant";

  const dateDisplay = escrow.created_at
    ? new Date(escrow.created_at).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "—";

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose && onClose()}>
      <DialogContent className="max-w-2xl max-h-[88vh] overflow-y-auto p-5 sm:p-6">
        {/* ── Dialog Header ────────────────────────────────────────── */}
        <DialogHeader className="pb-3 space-y-1">
          <div className="flex items-center justify-between gap-3 pr-6 flex-wrap">
            <div className="flex items-center gap-2 min-w-0">
              <ShieldCheck className="h-5 w-5 text-emerald-600 shrink-0" />
              <DialogTitle className="text-base sm:text-lg font-bold text-slate-900 truncate">
                {escrow.product_name}
              </DialogTitle>
              <Badge variant="outline" className="font-mono text-[10px] text-slate-500 shrink-0">
                {isOnChain ? `Escrow #${escrow.escrow_id}` : `Draft #${escrow.id}`}
              </Badge>
            </div>
            <StatusBadge status={escrow.status} />
          </div>
          <DialogDescription className="text-xs text-slate-500">
            {partnerLabel}: <span className="font-semibold text-slate-700">{resolvedPartner}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          {/* ── 4-Step Lifecycle Stepper ─────────────────────────────── */}
          <div className="bg-slate-50/80 border border-slate-200/80 rounded-2xl p-3.5 sm:p-4">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block mb-2">
              Transaction Lifecycle
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {ESCROW_STEPS.map((step, idx) => {
                const StepIcon = step.icon;
                const isDone = currentIdx > idx || currentIdx === 3;
                const isCurrent = currentIdx === idx && currentIdx !== 3;

                let stepStyle = "bg-white border-slate-200 text-slate-400";
                let dotStyle = "bg-slate-100 text-slate-400 border border-slate-200";
                let iconColor = "text-slate-400";

                if (isDone) {
                  stepStyle = "bg-emerald-50/80 border-emerald-300 text-emerald-900";
                  dotStyle = "bg-emerald-600 text-white";
                  iconColor = "text-emerald-700";
                } else if (isCurrent) {
                  stepStyle = "bg-blue-50 border-blue-400 text-blue-900 ring-1 ring-blue-400 shadow-2xs";
                  dotStyle = "bg-blue-600 text-white animate-pulse";
                  iconColor = "text-blue-700";
                }

                return (
                  <div
                    key={step.key}
                    className={`border rounded-xl p-2.5 text-center transition-all ${stepStyle}`}
                  >
                    <div className="flex items-center justify-center gap-1.5 mb-1">
                      <span className={`w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center ${dotStyle}`}>
                        {isDone ? "✓" : idx + 1}
                      </span>
                      <StepIcon className={`h-3.5 w-3.5 ${iconColor}`} />
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

          {/* ── PRIMARY SECTION: Commercial Transaction Overview ───────── */}
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-2xl p-4 sm:p-5 shadow-xs space-y-3">
            <div className="flex items-start justify-between gap-2 flex-wrap">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  Commercial Transaction Value
                </span>
                <div className="text-2xl sm:text-3xl font-extrabold font-mono text-emerald-400 mt-0.5">
                  {inrDisplay}
                </div>
              </div>
              <div className="text-right shrink-0">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  Transaction Status
                </span>
                <div className="mt-1">
                  <StatusBadge status={escrow.status} />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-slate-700/70 text-xs">
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Crop</span>
                <span className="font-semibold text-slate-100 block truncate">{escrow.product_name}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Quantity</span>
                <span className="font-mono font-semibold text-slate-100 block truncate">
                  {escrow.quantity} {escrow.unit}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Agreed Rate</span>
                <span className="font-mono font-semibold text-slate-100 block truncate">
                  {unitPriceDisplay}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Date</span>
                <span className="font-mono font-semibold text-slate-100 block truncate">
                  {dateDisplay}
                </span>
              </div>
            </div>
          </div>

          {/* ── SECONDARY SECTION: Counterparty & Deal Reference ──────── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                {partnerLabel}
              </span>
              <span className="font-bold text-slate-900 text-sm block mt-0.5 truncate">
                {resolvedPartner}
              </span>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                Contract Agreement Ref
              </span>
              <span className="font-mono font-bold text-slate-800 text-sm block mt-0.5 truncate">
                {isOnChain ? `Smart Contract Escrow #${escrow.escrow_id}` : `Draft Deal #${escrow.id}`}
              </span>
            </div>
          </div>

          {/* ── Transaction Completed Banner ──────────────────────────── */}
          {escrow.status === "released" && (
            <div className="p-4 bg-emerald-50/90 border border-emerald-300 rounded-2xl flex items-center justify-between gap-3 flex-wrap animate-fade-in">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="h-6 w-6 text-emerald-600 shrink-0" />
                <div>
                  <h4 className="text-sm font-bold text-emerald-950">
                    Transaction Completed & Settled
                  </h4>
                  <p className="text-xs text-emerald-800 mt-0.5">
                    Payment released and inventory transfer settled in full.
                  </p>
                </div>
              </div>
              <Badge variant="success" className="font-mono text-xs font-bold px-3 py-1">
                {inrDisplay} Paid
              </Badge>
            </div>
          )}

          {/* ── Workflow Action & Status Area (MetaMask Assisted Mode) ── */}
          {workflow && (onPrimaryAction || workflow.phase !== "idle") && (
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-3">
              <WorkflowStatusPanel
                workflow={workflow}
                mode={mode}
                onModeChange={onModeChange}
                onPrimaryAction={onPrimaryAction}
                primaryActionLabel={primaryActionLabel}
                retryEndpoint={retryEndpoint}
                retryData={retryData}
                escrow={escrow}
              />
            </div>
          )}

          {/* Info notice when partner action is pending */}
          {workflow && !onPrimaryAction && workflow.phase === "idle" && escrow.status !== "released" && (
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-500 flex items-center gap-2">
              <Clock className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              <span>
                {escrow.status === "created"
                  ? "Awaiting buyer deposit to secure escrow funds on-chain."
                  : escrow.status === "funded"
                  ? "Payment secured in escrow. Awaiting delivery handover."
                  : "Awaiting next transaction step from partner."}
              </span>
            </div>
          )}

          {/* Legacy fallback action area if workflow hook not passed */}
          {!workflow && actionButton && (
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
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                  <span>{actionStatus.success}</span>
                </div>
              )}

              {actionStatus?.error && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-800 animate-fade-in flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
                  <span>{actionStatus.error}</span>
                </div>
              )}
            </div>
          )}

          {/* ── COLLAPSIBLE SECTION: Blockchain Details (Collapsed by default) ── */}
          <BlockchainDetailsCollapse escrow={escrow} defaultOpen={false} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
