import React from "react";
import AddressCopy from "./AddressCopy";

/**
 * BlockchainDetailsCollapse — Phase 6: Expandable Blockchain Technical Details
 *
 * Core requirement:
 *  - Collapsed by default.
 *  - Separates technical Sepolia blockchain proof from primary commercial INR values.
 *  - Exposes contract addresses, transaction hashes, and testnet collateral only when expanded.
 *  - Provides copy buttons and Sepolia Etherscan explorer links.
 *  - Completely responsive with break-words/min-w-0 to prevent layout overflow.
 */
export default function BlockchainDetailsCollapse({
  escrow,
  compact = false,
  defaultOpen = false,
  className = "",
}) {
  if (!escrow) return null;

  const isOnChain = Boolean(escrow.escrow_id);

  return (
    <details
      open={defaultOpen}
      className={`group border border-slate-200/90 rounded-2xl bg-slate-50/60 transition-all text-xs overflow-hidden ${
        compact ? "p-2.5 text-[11px]" : "p-3.5 sm:p-4"
      } ${className}`}
    >
      <summary className="font-semibold text-slate-700 cursor-pointer flex items-center justify-between select-none list-none focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-lg">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm shrink-0">⛓️</span>
          <span className="font-bold text-slate-800 tracking-tight truncate">
            Blockchain Details
          </span>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200/70 text-slate-700 shrink-0">
            Sepolia
          </span>
        </div>
        <div className="flex items-center gap-1 text-slate-400 group-open:text-slate-700 transition-colors shrink-0">
          <span className="text-[10px] uppercase font-bold tracking-wider hidden sm:inline">
            Technical Proof
          </span>
          <span className="text-xs group-open:rotate-180 transition-transform inline-block duration-200">
            ▼
          </span>
        </div>
      </summary>

      <div className="space-y-2.5 pt-3 mt-3 border-t border-slate-200/80 min-w-0">
        {/* Network info */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-slate-600">
          <span className="font-medium text-slate-500 shrink-0">Network:</span>
          <span className="font-mono text-slate-800 truncate font-semibold">
            Ethereum Sepolia (Chain ID: 11155111)
          </span>
        </div>

        {/* On-Chain Escrow ID */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-slate-600">
          <span className="font-medium text-slate-500 shrink-0">Escrow Agreement ID:</span>
          <span className="font-mono font-bold text-slate-900">
            {isOnChain ? `#${escrow.escrow_id}` : "Pending on-chain registration"}
          </span>
        </div>

        {/* Technical testnet ETH collateral */}
        {escrow.amount_eth && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-slate-600">
            <span className="font-medium text-slate-500 shrink-0">Testnet Escrow Collateral:</span>
            <span className="font-mono text-slate-700">
              {escrow.amount_eth} ETH <span className="text-[10px] text-slate-400 font-sans">(Infrastructure settlement)</span>
            </span>
          </div>
        )}

        {/* Smart contract address */}
        {escrow.contract_address && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 min-w-0">
            <span className="font-medium text-slate-500 shrink-0">Smart Contract:</span>
            <AddressCopy
              value={escrow.contract_address}
              etherscanType="address"
              className="min-w-0"
            />
          </div>
        )}

        {/* Create transaction */}
        {escrow.create_tx_hash && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 min-w-0">
            <span className="font-medium text-slate-500 shrink-0">Create Tx Hash:</span>
            <AddressCopy
              value={escrow.create_tx_hash}
              etherscanType="tx"
              className="min-w-0"
            />
          </div>
        )}

        {/* Deposit transaction */}
        {escrow.deposit_tx_hash && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 min-w-0">
            <span className="font-medium text-slate-500 shrink-0">Deposit Tx Hash:</span>
            <AddressCopy
              value={escrow.deposit_tx_hash}
              etherscanType="tx"
              className="min-w-0"
            />
          </div>
        )}

        {/* Delivery transaction */}
        {escrow.delivery_tx_hash && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 min-w-0">
            <span className="font-medium text-slate-500 shrink-0">Handover Tx Hash:</span>
            <AddressCopy
              value={escrow.delivery_tx_hash}
              etherscanType="tx"
              className="min-w-0"
            />
          </div>
        )}

        {/* Release transaction */}
        {escrow.release_tx_hash && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 min-w-0">
            <span className="font-medium text-slate-500 shrink-0">Release Tx Hash:</span>
            <AddressCopy
              value={escrow.release_tx_hash}
              etherscanType="tx"
              className="min-w-0"
            />
          </div>
        )}

        <p className="text-[10px] text-slate-400 pt-1 border-t border-slate-200/50 italic">
          Blockchain transactions provide cryptographic proof on Sepolia testnet. Commercial price and invoicing are governed by INR (₹).
        </p>
      </div>
    </details>
  );
}
