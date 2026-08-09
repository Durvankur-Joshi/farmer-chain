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
      <div className="bg-white border rounded-2xl shadow p-5 mb-6 animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-1/4 mb-3"></div>
        <div className="h-8 bg-gray-200 rounded mb-2"></div>
      </div>
    );
  }

  if (!rep) return null;

  const colorStyles = {
    green: {
      border: "border-green-200",
      text: "text-green-700",
      bgBadge: "bg-green-100 text-green-800 border-green-300",
      bar: "bg-green-500",
    },
    blue: {
      border: "border-blue-200",
      text: "text-blue-700",
      bgBadge: "bg-blue-100 text-blue-800 border-blue-300",
      bar: "bg-blue-500",
    },
    purple: {
      border: "border-purple-200",
      text: "text-purple-700",
      bgBadge: "bg-purple-100 text-purple-800 border-purple-300",
      bar: "bg-purple-500",
    },
  };

  const style = colorStyles[accentColor] || colorStyles.green;
  const score = rep.trust_score || 50;

  return (
    <div className={`bg-white border ${style.border} rounded-2xl shadow p-5 mb-6`}>
      <div className="flex justify-between items-start flex-wrap gap-2 mb-3">
        <div>
          <h3 className={`text-sm font-semibold ${style.text} uppercase tracking-widest flex items-center gap-1.5`}>
            ⭐ Trust & Reputation Score
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Verified on-chain & supply-chain activity
          </p>
        </div>
        <span className={`text-xs font-semibold px-3 py-1 rounded-full border ${style.bgBadge}`}>
          {rep.trust_tier || "Verified Member ⭐"}
        </span>
      </div>

      {/* Trust Score Bar */}
      <div className="my-3">
        <div className="flex justify-between items-center text-sm font-bold text-gray-700 mb-1">
          <span>Trust Score</span>
          <span className="text-base font-extrabold">{score} / 100</span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden border border-gray-200">
          <div
            className={`h-full ${style.bar} transition-all duration-500 rounded-full`}
            style={{ width: `${Math.max(5, Math.min(100, score))}%` }}
          />
        </div>
      </div>

      {/* Metric Counters */}
      <div className="grid grid-cols-2 gap-3 mt-4 pt-3 border-t border-gray-100">
        <div className="bg-gray-50 rounded-xl p-3 text-center border border-gray-100">
          <p className="text-xl font-bold text-gray-800">
            {rep.completed_transactions}
          </p>
          <p className="text-xs text-gray-500 mt-0.5 font-medium">
            Completed Transactions
          </p>
        </div>
        <div className="bg-gray-50 rounded-xl p-3 text-center border border-gray-100">
          <p className="text-xl font-bold text-gray-800">
            {rep.verified_activities}
          </p>
          <p className="text-xs text-gray-500 mt-0.5 font-medium">
            Verified Activities
          </p>
        </div>
      </div>
    </div>
  );
}
