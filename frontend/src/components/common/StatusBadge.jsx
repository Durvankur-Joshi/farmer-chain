import React from "react";

const STATUS_CONFIG = {
  // Crop / NFT
  minted: { label: "NFT Minted", bg: "bg-purple-50 text-purple-700 border-purple-200", dot: "bg-purple-500" },
  registered: { label: "Registered", bg: "bg-slate-50 text-slate-700 border-slate-200", dot: "bg-slate-400" },
  
  // Escrow / Payment Lifecycle
  created: { label: "Escrow Created", bg: "bg-amber-50 text-amber-800 border-amber-200", dot: "bg-amber-500" },
  funded: { label: "Funded", bg: "bg-blue-50 text-blue-800 border-blue-200", dot: "bg-blue-500" },
  delivery_confirmed: { label: "Delivery Confirmed", bg: "bg-indigo-50 text-indigo-800 border-indigo-200", dot: "bg-indigo-500" },
  released: { label: "Completed", bg: "bg-emerald-50 text-emerald-800 border-emerald-200", dot: "bg-emerald-500" },
  completed: { label: "Completed", bg: "bg-emerald-50 text-emerald-800 border-emerald-200", dot: "bg-emerald-500" },
  cancelled: { label: "Cancelled", bg: "bg-rose-50 text-rose-800 border-rose-200", dot: "bg-rose-500" },
  disputed: { label: "Disputed", bg: "bg-red-50 text-red-800 border-red-200", dot: "bg-red-500" },

  // Commercial Payment Statuses
  processing: { label: "Payment Processing", bg: "bg-blue-50 text-blue-800 border-blue-200", dot: "bg-blue-400" },
  paid: { label: "Paid", bg: "bg-emerald-50 text-emerald-800 border-emerald-200", dot: "bg-emerald-500" },
  failed: { label: "Failed", bg: "bg-rose-50 text-rose-800 border-rose-200", dot: "bg-rose-500" },

  // Inventory
  in_stock: { label: "In Stock", bg: "bg-emerald-50 text-emerald-800 border-emerald-200", dot: "bg-emerald-500" },
  available: { label: "Available", bg: "bg-emerald-50 text-emerald-800 border-emerald-200", dot: "bg-emerald-500" },
  reserved: { label: "Reserved", bg: "bg-amber-50 text-amber-800 border-amber-200", dot: "bg-amber-500" },
  depleted: { label: "Depleted", bg: "bg-slate-100 text-slate-600 border-slate-200", dot: "bg-slate-400" },

  // Approval / Verification
  approved: { label: "Approved", bg: "bg-emerald-50 text-emerald-800 border-emerald-200", dot: "bg-emerald-500" },
  pending: { label: "Pending", bg: "bg-amber-50 text-amber-800 border-amber-200", dot: "bg-amber-400 animate-pulse" },
  rejected: { label: "Rejected", bg: "bg-rose-50 text-rose-800 border-rose-200", dot: "bg-rose-500" },
  verified: { label: "AI Verified", bg: "bg-emerald-50 text-emerald-800 border-emerald-200", dot: "bg-emerald-500" },

  // Quotes / Bids
  open: { label: "Open for Bids", bg: "bg-emerald-50 text-emerald-800 border-emerald-200", dot: "bg-emerald-500" },
  accepted: { label: "Bid Accepted", bg: "bg-blue-50 text-blue-800 border-blue-200", dot: "bg-blue-500" },
  awarded: { label: "Awarded", bg: "bg-blue-50 text-blue-800 border-blue-200", dot: "bg-blue-500" },
  contract_created: { label: "Contract Created", bg: "bg-indigo-50 text-indigo-800 border-indigo-200", dot: "bg-indigo-500" },
  submitted: { label: "Bid Submitted", bg: "bg-blue-50 text-blue-800 border-blue-200", dot: "bg-blue-400" },
  closed: { label: "Closed", bg: "bg-slate-100 text-slate-600 border-slate-200", dot: "bg-slate-400" },
};

export default function StatusBadge({ status, customLabel }) {
  const norm = (status || "").toLowerCase();
  const config = STATUS_CONFIG[norm] || {
    label: customLabel || status || "Unknown",
    bg: "bg-slate-50 text-slate-700 border-slate-200",
    dot: "bg-slate-400",
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${config.bg} shadow-2xs whitespace-nowrap`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
      {customLabel || config.label}
    </span>
  );
}
