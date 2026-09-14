/**
 * WorkflowStatusPanel — Phase 3: MetaMask Assisted Mode UI
 *
 * Compact, reusable panel that renders inside EscrowDealModal's action area.
 * Displays workflow phase, mode selector, action button, and error/success states.
 *
 * DISPLAY RULES (enforced):
 *  - Commercial value (₹) is always PRIMARY.
 *  - ETH is SECONDARY and always labelled "Testnet settlement" — never "crop price".
 *  - ₹X = Y ETH conversion is NEVER shown.
 *  - Seed phrases and private keys are NEVER referenced.
 */

import React from "react";
import { formatInr } from "../../utils/pricing";

const SEPOLIA_EXPLORER = "https://sepolia.etherscan.io";

// ── Phase display config ───────────────────────────────────────────────────
const PHASE_CONFIG = {
  idle: null, // no panel shown at idle
  checking_wallet: {
    icon: "🔍",
    title: "Checking MetaMask",
    description: "Verifying your wallet is installed and connected…",
    showSpinner: true,
  },
  connecting_wallet: {
    icon: "🦊",
    title: "Connecting Wallet",
    description: "MetaMask is requesting your permission to connect. Check the extension.",
    showSpinner: true,
  },
  checking_network: {
    icon: "🌐",
    title: "Checking Network",
    description: "Verifying you are on Ethereum Sepolia testnet…",
    showSpinner: true,
  },
  switching_network: {
    icon: "🔄",
    title: "Switching to Sepolia",
    description: "MetaMask is asking you to switch to Ethereum Sepolia. Approve in the extension.",
    showSpinner: true,
  },
  preparing_transaction: {
    icon: "📋",
    title: "Preparing Transaction",
    description: "Loading escrow parameters from FarmerChain…",
    showSpinner: true,
  },
  awaiting_wallet_confirmation: {
    icon: "🦊",
    title: "Awaiting Your Approval",
    description: "MetaMask has opened (check the extension or browser popup). Review and approve the transaction.",
    showSpinner: false,
    isWaiting: true, // pulse animation
  },
  transaction_submitted: {
    icon: "⛓️",
    title: "Transaction Submitted",
    description: "Your transaction is on the Sepolia blockchain. Waiting for confirmation…",
    showSpinner: true,
  },
  syncing_backend: {
    icon: "🔄",
    title: "Recording on FarmerChain",
    description: "Saving your transaction record…",
    showSpinner: true,
  },
  completed: {
    icon: "✅",
    title: "Transaction Complete",
    description: "Your blockchain action is confirmed and recorded.",
    isSuccess: true,
  },
  user_rejected: {
    icon: "✋",
    title: "Transaction Cancelled",
    isError: true,
    errorType: "user_rejected",
  },
  wallet_error: {
    icon: "⚠️",
    title: "Wallet Error",
    isError: true,
    errorType: "wallet_error",
  },
  network_error: {
    icon: "🌐",
    title: "Wrong Network",
    isError: true,
    errorType: "network_error",
  },
  insufficient_funds: {
    icon: "💸",
    title: "Insufficient Funds",
    isError: true,
    errorType: "insufficient_funds",
  },
  backend_error: {
    icon: "⚡",
    title: "Sync Error (Blockchain OK)",
    isError: true,
    errorType: "backend_error",
  },
};

// ── Action label map ───────────────────────────────────────────────────────
const ACTION_LABELS = {
  create_escrow: "Create Escrow",
  complete_onchain: "Register On-Chain",
  fund_escrow: "Deposit Funds",
  confirm_delivery: "Confirm Delivery",
  release_payment: "Release Payment",
  create_retailer_escrow: "Create Wholesale Escrow",
  fund_retailer_escrow: "Lock Funds in Escrow",
  confirm_retailer_delivery: "Confirm Shipment",
  release_retailer_payment: "Release Payment & Receive Stock",
};

// ── Subcomponents ──────────────────────────────────────────────────────────

function Spinner() {
  return (
    <svg
      className="animate-spin h-3.5 w-3.5 text-blue-600"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}

function TxHashLink({ hash }) {
  if (!hash) return null;
  const short = `${hash.slice(0, 8)}…${hash.slice(-6)}`;
  return (
    <a
      href={`${SEPOLIA_EXPLORER}/tx/${hash}`}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1 font-mono text-[11px] text-blue-600 hover:text-blue-800 hover:underline transition-colors"
    >
      <span>🔗</span>
      <span>{short}</span>
      <span className="text-slate-400">(Sepolia)</span>
    </a>
  );
}

function ModeSelector({ mode, onChange, disabled }) {
  return (
    <div className="flex items-center gap-0.5 p-0.5 bg-slate-100 rounded-lg shrink-0">
      <button
        type="button"
        onClick={() => onChange("assisted")}
        disabled={disabled}
        className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer disabled:cursor-not-allowed ${
          mode === "assisted"
            ? "bg-white text-blue-700 shadow-xs border border-blue-200"
            : "text-slate-500 hover:text-slate-700"
        }`}
        title="Assisted Mode: guided step-by-step workflow"
      >
        ⚡ Assisted
      </button>
      <button
        type="button"
        onClick={() => onChange("manual")}
        disabled={disabled}
        className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer disabled:cursor-not-allowed ${
          mode === "manual"
            ? "bg-white text-slate-800 shadow-xs border border-slate-300"
            : "text-slate-500 hover:text-slate-700"
        }`}
        title="Manual Mode: explicit confirmation at each step"
      >
        🔧 Manual
      </button>
    </div>
  );
}

// ── Commercial summary ─────────────────────────────────────────────────────
function CommercialSummary({ escrow }) {
  if (!escrow) return null;

  // INR is always primary (Phase 1/2 source of truth)
  const inrVal =
    escrow.agreed_price_inr != null
      ? parseFloat(escrow.agreed_price_inr)
      : escrow.total_amount_inr != null
      ? parseFloat(escrow.total_amount_inr)
      : escrow.amount_inr != null
      ? parseFloat(escrow.amount_inr)
      : null;

  const ethVal = escrow.amount_eth ? parseFloat(escrow.amount_eth) : null;

  return (
    <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
      <div className="flex-1 min-w-0">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
          Commercial Deal
        </span>
        <span className="font-extrabold text-emerald-700 text-sm font-mono">
          {inrVal != null ? formatInr(inrVal) : "—"}
        </span>
        {escrow.product_name && (
          <span className="text-slate-500 block truncate mt-0.5">
            {escrow.product_name}
            {escrow.quantity && escrow.unit ? ` · ${escrow.quantity} ${escrow.unit}` : ""}
          </span>
        )}
      </div>
      <div className="text-right shrink-0">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
          Blockchain
        </span>
        <span className="font-semibold text-slate-600 block">Sepolia Testnet</span>
        {ethVal != null && (
          <span className="text-[10px] text-slate-400 font-mono block">
            Testnet settlement: {ethVal} ETH
          </span>
        )}
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

/**
 * @param {Object} props
 * @param {Object} props.workflow         - The useEscrowWorkflow hook return value
 * @param {'assisted'|'manual'} props.mode      - Current mode
 * @param {Function} props.onModeChange         - Called with new mode string
 * @param {Function} props.onPrimaryAction      - Called when the primary action button is clicked
 * @param {string|null} props.primaryActionLabel- Label override for the action button
 * @param {boolean} props.primaryActionDisabled - Whether the action button is disabled independently
 * @param {string|null} props.retryEndpoint     - Backend endpoint for backend_error retry
 * @param {Object|null} props.retryData         - Data for backend_error retry
 */
export default function WorkflowStatusPanel({
  workflow,
  mode = "assisted",
  onModeChange,
  onPrimaryAction,
  primaryActionLabel,
  primaryActionDisabled = false,
  retryEndpoint = null,
  retryData = null,
  escrow = null,
}) {
  const { phase, txHash, errorMessage, currentEscrow, currentAction, isLocked } = workflow;
  const config = PHASE_CONFIG[phase];
  const activeEscrow = currentEscrow || escrow;

  // Derive action button label
  const actionLabel =
    primaryActionLabel ||
    (currentAction ? ACTION_LABELS[currentAction] : "Execute Action");

  // At idle, just show the mode selector + action button (no status panel)
  if (phase === "idle") {
    return (
      <div className="space-y-3">
        {/* Commercial summary */}
        <CommercialSummary escrow={activeEscrow} />

        {/* Mode selector + action */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <ModeSelector mode={mode} onChange={onModeChange} disabled={false} />
          {onPrimaryAction && (
            <button
              type="button"
              id="workflow-primary-action"
              onClick={onPrimaryAction}
              disabled={primaryActionDisabled}
              className="flex-1 sm:flex-none px-4 py-2 text-xs font-bold text-white rounded-xl transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed bg-emerald-600 hover:bg-emerald-500"
            >
              <span>▶</span>
              <span>{actionLabel}</span>
            </button>
          )}
        </div>

        {/* Manual mode guidance */}
        {mode === "manual" && (
          <p className="text-[11px] text-slate-500 leading-relaxed">
            🔧 <strong>Manual Mode:</strong> You will review and confirm each blockchain action explicitly.
          </p>
        )}
        {mode === "assisted" && (
          <p className="text-[11px] text-slate-500 leading-relaxed">
            ⚡ <strong>Assisted Mode:</strong> The system will guide you through each step and open MetaMask when your approval is needed.
          </p>
        )}
      </div>
    );
  }

  // Null guard
  if (!config) return null;

  // ── Active / Pending states ──────────────────────────────────────────
  if (!config.isError && !config.isSuccess) {
    return (
      <div className="space-y-3">
        <CommercialSummary escrow={activeEscrow} />

        {/* Mode selector (disabled while active) */}
        <div className="flex items-center justify-between gap-2">
          <ModeSelector mode={mode} onChange={() => {}} disabled={true} />
          <span className="text-[11px] text-slate-400 font-medium">
            {actionLabel}
          </span>
        </div>

        {/* Status banner */}
        <div
          className={`flex items-start gap-3 p-3 rounded-xl border text-xs ${
            config.isWaiting
              ? "bg-amber-50 border-amber-200 text-amber-900"
              : "bg-blue-50 border-blue-200 text-blue-900"
          }`}
        >
          <div className="shrink-0 mt-0.5">
            {config.showSpinner ? (
              <Spinner />
            ) : (
              <span
                className={config.isWaiting ? "animate-pulse text-base" : "text-base"}
              >
                {config.icon}
              </span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <span className="font-bold block">{config.title}</span>
            <span className="text-xs leading-relaxed opacity-80">{config.description}</span>
            {txHash && (
              <div className="mt-1">
                <TxHashLink hash={txHash} />
              </div>
            )}
          </div>
        </div>

        {/* MetaMask waiting instruction */}
        {phase === "awaiting_wallet_confirmation" && (
          <div className="p-2.5 bg-amber-50 border border-amber-300 rounded-xl text-[11px] text-amber-900 font-semibold flex items-center gap-2">
            <span>🦊</span>
            <span>
              Check the MetaMask extension icon in your browser toolbar. Your approval is required to continue.
            </span>
          </div>
        )}
      </div>
    );
  }

  // ── Success state ────────────────────────────────────────────────────
  if (config.isSuccess) {
    return (
      <div className="space-y-3">
        <CommercialSummary escrow={activeEscrow} />

        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-base">✅</span>
            <span className="font-bold text-emerald-800">Transaction Complete</span>
          </div>
          {txHash && (
            <div className="pl-6 space-y-1">
              <span className="text-slate-600 block">Blockchain confirmation:</span>
              <TxHashLink hash={txHash} />
            </div>
          )}
        </div>

        {/* Allow retry for next step or close */}
        <div className="flex items-center justify-between gap-2 pt-1">
          <ModeSelector mode={mode} onChange={onModeChange} disabled={false} />
          <button
            type="button"
            onClick={workflow.reset}
            className="px-3.5 py-1.5 text-xs font-semibold text-slate-700 rounded-xl border border-slate-200 hover:bg-slate-50 transition-all cursor-pointer"
          >
            ✓ Done
          </button>
        </div>
      </div>
    );
  }

  // ── Error states ─────────────────────────────────────────────────────
  const isBackendError = phase === "backend_error";
  const isUserRejected = phase === "user_rejected";

  return (
    <div className="space-y-3">
      <CommercialSummary escrow={activeEscrow} />

      {/* Error banner */}
      <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs space-y-2">
        <div className="flex items-start gap-2">
          <span className="text-base shrink-0 mt-0.5">{config.icon}</span>
          <div className="flex-1 min-w-0">
            <span className="font-bold text-rose-800 block">{config.title}</span>
            <span className="text-rose-700 leading-relaxed block mt-0.5">
              {errorMessage || config.description}
            </span>
            {/* For backend_error: show preserved tx hash */}
            {isBackendError && txHash && (
              <div className="mt-1.5 p-2 bg-white rounded-lg border border-rose-200 space-y-1">
                <span className="font-semibold text-slate-700 block text-[10px] uppercase tracking-wider">
                  Blockchain transaction (confirmed):
                </span>
                <TxHashLink hash={txHash} />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Action buttons for error recovery */}
      <div className="flex items-center gap-2 flex-wrap">
        <ModeSelector mode={mode} onChange={onModeChange} disabled={false} />

        <div className="flex items-center gap-2 ml-auto flex-wrap">
          {/* Retry sync (backend_error only) */}
          {isBackendError && retryEndpoint && retryData && (
            <button
              type="button"
              onClick={() => workflow.retryBackendSync(retryEndpoint, retryData)}
              className="px-3.5 py-1.5 text-xs font-bold text-white rounded-xl bg-amber-600 hover:bg-amber-500 transition-all shadow-xs cursor-pointer flex items-center gap-1"
            >
              <span>🔄</span>
              <span>Retry Sync</span>
            </button>
          )}

          {/* Retry action (user_rejected, wallet_error, network_error, insufficient_funds) */}
          {!isBackendError && onPrimaryAction && (
            <button
              type="button"
              onClick={() => { workflow.reset(); }}
              className="px-3.5 py-1.5 text-xs font-semibold text-slate-700 rounded-xl border border-slate-200 hover:bg-slate-50 transition-all cursor-pointer"
            >
              ← Back
            </button>
          )}
          {!isBackendError && onPrimaryAction && (
            <button
              type="button"
              onClick={onPrimaryAction}
              className="px-3.5 py-1.5 text-xs font-bold text-white rounded-xl bg-slate-800 hover:bg-slate-700 transition-all shadow-xs cursor-pointer flex items-center gap-1"
            >
              <span>↩</span>
              <span>{isUserRejected ? "Try Again" : "Retry"}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
