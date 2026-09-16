import React, { useState } from "react";
import { useSocket } from "../../context/useSocket";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sprout,
  Building2,
  Store,
  Shield,
  Menu,
  Copy,
  Check,
  LogOut,
  Activity,
  Globe,
} from "lucide-react";

export default function DashboardNavbar({
  role = "farmer",
  userName,
  didInfo,
  onLogout,
  onToggleMobileMenu,
}) {
  const { isConnected } = useSocket();
  const [copiedDid, setCopiedDid] = useState(false);

  const handleCopyDid = (e) => {
    e.stopPropagation();
    if (didInfo?.did) {
      navigator.clipboard.writeText(didInfo.did);
      setCopiedDid(true);
      setTimeout(() => setCopiedDid(false), 2000);
    }
  };

  const roleConfig = {
    farmer: {
      badge: "bg-emerald-50 text-emerald-800 border-emerald-200",
      title: "Farmer Portal",
      icon: Sprout,
    },
    fpo: {
      badge: "bg-blue-50 text-blue-800 border-blue-200",
      title: "FPO Procurement Portal",
      icon: Building2,
    },
    retailer: {
      badge: "bg-purple-50 text-purple-800 border-purple-200",
      title: "Retailer Market Portal",
      icon: Store,
    },
    admin: {
      badge: "bg-slate-800 text-slate-100 border-slate-700",
      title: "Admin Command Center",
      icon: Shield,
    },
  };

  const currentRole = role.toLowerCase();
  const config = roleConfig[currentRole] || roleConfig.farmer;
  const RoleIcon = config.icon;

  return (
    <header className="bg-white/95 backdrop-blur-md border-b border-slate-200/80 sticky top-0 z-40 shadow-2xs">
      <div className="w-full px-4 sm:px-6 lg:px-8 py-2.5 flex items-center justify-between gap-3">
        {/* Brand & Mobile Menu Toggle */}
        <div className="flex items-center gap-3 min-w-0">
          {onToggleMobileMenu && (
            <button
              type="button"
              onClick={onToggleMobileMenu}
              className="lg:hidden p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-all cursor-pointer shrink-0"
              aria-label="Toggle navigation menu"
              title="Toggle Menu"
            >
              <Menu className="h-4 w-4" />
            </button>
          )}

          {/* Logo */}
          <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center shadow-2xs text-white shrink-0">
            <Sprout className="h-4 w-4" />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-slate-900 text-sm sm:text-base tracking-tight truncate">
                FarmerChain
              </span>

              {/* Portal label */}
              <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200/70 shrink-0">
                <RoleIcon className="h-3 w-3 text-emerald-600" />
                <span>{config.title}</span>
              </span>

              {/* Sepolia Indicator */}
              <span className="hidden md:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200 shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>Sepolia</span>
              </span>

              {/* Real-time Sync Status */}
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border transition-colors shrink-0 ${
                  isConnected
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200/80"
                    : "bg-amber-50 text-amber-700 border-amber-200/80"
                }`}
                title={isConnected ? "Real-time sync connected" : "Connecting to real-time sync..."}
              >
                <Activity className="h-3 w-3 shrink-0" />
                <span className="text-[9px] uppercase tracking-wider font-semibold">
                  {isConnected ? "Live Sync" : "Syncing"}
                </span>
              </span>
            </div>
          </div>
        </div>

        {/* User Context & Actions */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {userName && (
            <div className="hidden md:flex flex-col items-end text-right min-w-0">
              <span className="text-xs font-bold text-slate-800 truncate">
                {userName}
              </span>
              {didInfo?.did ? (
                <button
                  type="button"
                  onClick={handleCopyDid}
                  className="text-[10px] text-slate-400 hover:text-emerald-700 font-mono flex items-center gap-1 transition-colors cursor-pointer"
                  title="Click to copy DID"
                  aria-label="Click to copy DID"
                >
                  <span>
                    {didInfo.did.length > 20
                      ? `${didInfo.did.slice(0, 8)}…${didInfo.did.slice(-6)}`
                      : didInfo.did}
                  </span>
                  {copiedDid ? (
                    <Check className="h-3 w-3 text-emerald-600" />
                  ) : (
                    <Copy className="h-3 w-3 text-slate-400 hover:text-slate-600" />
                  )}
                </button>
              ) : (
                <span className="text-[10px] text-slate-400 font-mono">
                  Verified Participant
                </span>
              )}
            </div>
          )}

          <Badge
            variant="outline"
            className="text-[10px] sm:text-xs uppercase font-bold px-2 py-0.5 text-emerald-800 bg-emerald-50/80 border-emerald-200 tracking-wider shrink-0"
          >
            {role}
          </Badge>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onLogout}
            className="h-8 px-2.5 text-xs font-semibold text-slate-600 hover:text-rose-600 hover:border-rose-200 hover:bg-rose-50/50 gap-1.5 cursor-pointer shrink-0"
            title="Log out of session"
            aria-label="Log out of session"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Logout</span>
          </Button>
        </div>
      </div>
    </header>
  );
}
