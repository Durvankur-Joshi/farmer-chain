import React from "react";

export default function DashboardNavbar({
  role = "farmer",
  userName,
  didInfo,
  onLogout,
}) {
  const roleThemes = {
    farmer: {
      badge: "bg-emerald-50 text-emerald-700 border-emerald-200",
      title: "Farmer Portal",
      icon: "🌱",
    },
    fpo: {
      badge: "bg-blue-50 text-blue-700 border-blue-200",
      title: "FPO Procurement Portal",
      icon: "🏢",
    },
    retailer: {
      badge: "bg-purple-50 text-purple-700 border-purple-200",
      title: "Retailer Market Portal",
      icon: "🏪",
    },
    admin: {
      badge: "bg-slate-800 text-slate-100 border-slate-700",
      title: "Admin Command Center",
      icon: "🛡️",
    },
  };

  const theme = roleThemes[role.toLowerCase()] || roleThemes.farmer;

  return (
    <header className="bg-white/95 backdrop-blur-md border-b border-slate-200/80 sticky top-0 z-40 shadow-2xs">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between gap-4">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center text-xl shadow-sm text-white font-bold">
            🌾
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-slate-900 text-lg tracking-tight">
                FarmerChain
              </span>
              <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Sepolia
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium">
              {theme.icon} {theme.title}
            </p>
          </div>
        </div>

        {/* User Context & Actions */}
        <div className="flex items-center gap-3">
          {userName && (
            <div className="hidden md:flex flex-col items-end text-right">
              <span className="text-xs font-semibold text-slate-800">
                {userName}
              </span>
              <span className="text-[10px] text-slate-400 font-mono">
                {didInfo?.did ? `${didInfo.did.slice(0, 18)}…` : "Verified Participant"}
              </span>
            </div>
          )}

          <span
            className={`text-xs uppercase font-bold px-2.5 py-1 rounded-lg border ${theme.badge} tracking-wider`}
          >
            {role}
          </span>

          <button
            type="button"
            onClick={onLogout}
            className="flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-rose-600 px-3 py-1.5 rounded-lg border border-slate-200 hover:border-rose-200 hover:bg-rose-50/50 transition-all cursor-pointer"
            title="Log out of session"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </div>
    </header>
  );
}
