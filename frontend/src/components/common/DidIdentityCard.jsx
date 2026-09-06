import React from "react";
import AddressCopy from "./AddressCopy";

export default function DidIdentityCard({ didInfo, accentColor = "emerald" }) {
  if (!didInfo || !didInfo.did) return null;

  const colorStyles = {
    emerald: {
      border: "border-emerald-200/80 bg-gradient-to-r from-emerald-50/40 to-white",
      badge: "bg-emerald-100 text-emerald-800 border-emerald-300",
      title: "text-emerald-800",
    },
    blue: {
      border: "border-blue-200/80 bg-gradient-to-r from-blue-50/40 to-white",
      badge: "bg-blue-100 text-blue-800 border-blue-300",
      title: "text-blue-800",
    },
    purple: {
      border: "border-purple-200/80 bg-gradient-to-r from-purple-50/40 to-white",
      badge: "bg-purple-100 text-purple-800 border-purple-300",
      title: "text-purple-800",
    },
    slate: {
      border: "border-slate-300/80 bg-gradient-to-r from-slate-50/40 to-white",
      badge: "bg-slate-200 text-slate-800 border-slate-300",
      title: "text-slate-800",
    },
  };

  const style = colorStyles[accentColor] || colorStyles.emerald;

  return (
    <div
      className={`border ${style.border} rounded-2xl p-4 sm:p-5 shadow-2xs backdrop-blur-xs transition-all`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <span className="text-base sm:text-lg">🔐</span>
          <h3 className={`text-xs font-bold uppercase tracking-wider ${style.title}`}>
            Decentralized Identity (DID)
          </h3>
        </div>
        <span className={`text-[10px] uppercase font-bold px-2.5 py-0.5 rounded-full border ${style.badge}`}>
          W3C Verified · {didInfo.role || "Participant"}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
        <div className="bg-white/80 border border-slate-100 rounded-xl p-3 shadow-2xs min-w-0">
          <p className="text-[11px] font-semibold text-slate-500 mb-1">
            Decentralized Identifier (DID)
          </p>
          <AddressCopy value={didInfo.did} truncate={true} truncateLength={22} className="text-slate-800 text-[11px]" />
        </div>

        <div className="bg-white/80 border border-slate-100 rounded-xl p-3 shadow-2xs min-w-0">
          <p className="text-[11px] font-semibold text-slate-500 mb-1">
            Linked Sepolia Wallet
          </p>
          <AddressCopy
            value={didInfo.wallet_address}
            etherscanType="address"
            truncate={true}
            truncateLength={20}
            className="text-slate-800 text-[11px]"
          />
        </div>
      </div>
    </div>
  );
}
