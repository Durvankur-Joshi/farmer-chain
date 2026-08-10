import React, { useState, useEffect } from "react";
import axios from "axios";

export default function TrustReputationCard({ accentColor = "green" }) {
  const [rep, setRep] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios
      .get("/api/reputation/me/", { withCredentials: true })
      .then((res) => {
        setRep(res.data);
      })
      .catch((err) => {
        console.warn("Could not load reputation:", err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="bg-white border border-slate-200/80 rounded-2xl p-5 mb-6 shadow-xs animate-pulse">
        <div className="h-4 bg-slate-100 rounded w-1/3 mb-3"></div>
        <div className="h-2.5 bg-slate-100 rounded-full mb-3"></div>
        <div className="grid grid-cols-2 gap-3 mt-3">
          <div className="h-14 bg-slate-50 rounded-xl"></div>
          <div className="h-14 bg-slate-50 rounded-xl"></div>
        </div>
      </div>
    );
  }

  if (!rep) return null;

  const colorStyles = {
    green: {
      border: "border-emerald-200/80 bg-white",
      text: "text-emerald-800",
      bgBadge: "bg-emerald-50 text-emerald-800 border-emerald-300",
      bar: "bg-gradient-to-r from-emerald-500 to-green-500",
    },
    blue: {
      border: "border-blue-200/80 bg-white",
      text: "text-blue-800",
      bgBadge: "bg-blue-50 text-blue-800 border-blue-300",
      bar: "bg-gradient-to-r from-blue-500 to-indigo-500",
    },
    purple: {
      border: "border-purple-200/80 bg-white",
      text: "text-purple-800",
      bgBadge: "bg-purple-50 text-purple-800 border-purple-300",
      bar: "bg-gradient-to-r from-purple-500 to-fuchsia-500",
    },
  };

  const style = colorStyles[accentColor] || colorStyles.green;
  const score = rep.trust_score || 50;

  return (
    <div className={`border ${style.border} rounded-2xl shadow-xs p-5 mb-6 transition-all`}>
      <div className="flex justify-between items-start flex-wrap gap-2 mb-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">⭐</span>
          <div>
            <h3 className={`text-xs font-bold ${style.text} uppercase tracking-wider`}>
              Trust & Reputation Score
            </h3>
            <p className="text-[11px] text-slate-500 font-medium">
              Verified multi-signal Web3 reputation
            </p>
          </div>
        </div>
        <span className={`text-xs font-semibold px-3 py-1 rounded-full border ${style.bgBadge} shadow-2xs`}>
          {rep.trust_tier || "Verified Member ⭐"}
        </span>
      </div>

      {/* Trust Score Bar */}
      <div className="my-3">
        <div className="flex justify-between items-center text-xs font-bold text-slate-700 mb-1.5">
          <span>Reputation Index</span>
          <span className="text-sm font-extrabold text-slate-900">{score} <span className="text-xs text-slate-400 font-normal">/ 100</span></span>
        </div>
        <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden border border-slate-200/60 p-0.5">
          <div
            className={`h-full ${style.bar} transition-all duration-700 rounded-full`}
            style={{ width: `${Math.max(6, Math.min(100, score))}%` }}
          />
        </div>
      </div>

      {/* Metric Counters */}
      <div className="grid grid-cols-2 gap-3 mt-4 pt-3 border-t border-slate-100">
        <div className="bg-slate-50/70 rounded-xl p-3 text-center border border-slate-100/80">
          <p className="text-xl font-extrabold text-slate-800 tracking-tight">
            {rep.completed_transactions}
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5 font-medium">
            Completed Transactions
          </p>
        </div>
        <div className="bg-slate-50/70 rounded-xl p-3 text-center border border-slate-100/80">
          <p className="text-xl font-extrabold text-slate-800 tracking-tight">
            {rep.verified_activities}
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5 font-medium">
            Verified Activities
          </p>
        </div>
      </div>
    </div>
  );
}
