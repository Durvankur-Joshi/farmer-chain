import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import Cookies from "js-cookie";
import { useNavigate } from "react-router-dom";
import FarmerQuotes from "../../components/fpo/FarmerQuotes";
import RetailerQuotes from "../../components/fpo/RetailerQuotes";
import FpoEscrowPanel from "../../components/fpo/FpoEscrowPanel";
import TrustReputationCard from "../../components/common/TrustReputationCard";
import DidIdentityCard from "../../components/common/DidIdentityCard";
import DashboardNavbar from "../../components/common/DashboardNavbar";

export default function FpoDashboard() {
  const [activeTab, setActiveTab] = useState("farmer");
  const navigate = useNavigate();
  const [didInfo, setDidInfo] = useState(null);
  const [farmerQuotesCount, setFarmerQuotesCount] = useState(0);
  const [marketQuotesCount, setMarketQuotesCount] = useState(0);
  const [escrowsCount, setEscrowsCount] = useState(0);

  const logout = async () => {
    try {
      await axios.post("/api/token/logout/", {}, { withCredentials: true });
    } catch (err) {
      console.error("Logout error:", err);
    } finally {
      Cookies.remove("role", { path: "/" });
      navigate("/");
    }
  };

  // Fetch DID identity
  const fetchDid = useCallback(async () => {
    try {
      const res = await axios.get("/api/did/me/", { withCredentials: true });
      setDidInfo(res.data);
    } catch (err) {
      console.error("Could not fetch DID:", err);
    }
  }, []);

  // Fetch real overview metrics
  const fetchOverviewMetrics = useCallback(async () => {
    try {
      const [farmerRes, marketRes, escrowRes] = await Promise.allSettled([
        axios.get("/api/fpo/quotes/farmer/open/", { withCredentials: true }),
        axios.get("/api/fpo/quotes/", { withCredentials: true }),
        axios.get("/api/escrow/my/", { withCredentials: true }),
      ]);

      if (farmerRes.status === "fulfilled") {
        setFarmerQuotesCount(farmerRes.value.data?.length || 0);
      }
      if (marketRes.status === "fulfilled") {
        setMarketQuotesCount(marketRes.value.data?.length || 0);
      }
      if (escrowRes.status === "fulfilled") {
        setEscrowsCount(escrowRes.value.data?.escrows?.length || 0);
      }
    } catch (err) {
      console.error("Error fetching overview metrics:", err);
    }
  }, []);

  useEffect(() => {
    fetchDid();
    fetchOverviewMetrics();
  }, [fetchDid, fetchOverviewMetrics]);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col text-slate-900 font-sans">
      {/* ── Top Header Navbar ───────────────────────────────────────── */}
      <DashboardNavbar
        role="fpo"
        userName={didInfo?.name || "FPO Organization"}
        didInfo={didInfo}
        onLogout={logout}
      />

      <div className="max-w-6xl mx-auto w-full px-4 sm:px-6 py-6 sm:py-8 flex-1 space-y-6">

        {/* ── Welcome & Procurement Overview Banner ─────────────────── */}
        <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
          <div className="absolute top-[-20%] right-[-10%] w-[40%] h-[140%] rounded-full bg-blue-500/10 blur-2xl pointer-events-none" />
          
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-700/80 border border-blue-500/40 text-blue-100">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                  Farmer Producer Organization (FPO) Portal
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                {didInfo?.name || "FPO Procurement Center"}
              </h1>
              <p className="text-xs sm:text-sm text-blue-100/80 max-w-xl">
                Aggregate agricultural supply from verified farmers, lock escrow funds on Sepolia, and supply wholesale crop lots to retail buyers.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => setActiveTab("farmer")}
                className="bg-blue-500 hover:bg-blue-400 text-slate-950 text-xs font-extrabold px-4 py-2.5 rounded-xl transition-all shadow-md shadow-blue-950/30 flex items-center gap-1.5 cursor-pointer"
              >
                <span>🌾</span>
                <span>Procure from Farmers</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("retailer")}
                className="bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-all shadow-md shadow-purple-900/30 flex items-center gap-1.5 cursor-pointer"
              >
                <span>🛒</span>
                <span>Publish Market Quote</span>
              </button>
            </div>
          </div>
        </div>

        {/* ── Summary Key Metrics Bar (Real Loaded Data Only) ─────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-2xs hover:border-blue-200 transition-all">
            <div className="flex justify-between items-start">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Farmer Quotes</span>
              <span className="text-lg">🌾</span>
            </div>
            <p className="text-2xl font-extrabold text-slate-900 mt-1 tracking-tight">
              {farmerQuotesCount}
            </p>
            <p className="text-[11px] text-blue-600 font-semibold mt-0.5">
              Available for Procurement Bids
            </p>
          </div>

          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-2xs hover:border-purple-200 transition-all">
            <div className="flex justify-between items-start">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Market Quotes</span>
              <span className="text-lg">🛒</span>
            </div>
            <p className="text-2xl font-extrabold text-slate-900 mt-1 tracking-tight">
              {marketQuotesCount}
            </p>
            <p className="text-[11px] text-purple-600 font-semibold mt-0.5">
              Active Wholesale Lots
            </p>
          </div>

          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-2xs hover:border-amber-200 transition-all">
            <div className="flex justify-between items-start">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Active Escrows</span>
              <span className="text-lg">🔐</span>
            </div>
            <p className="text-2xl font-extrabold text-slate-900 mt-1 tracking-tight">
              {escrowsCount}
            </p>
            <p className="text-[11px] text-amber-600 font-semibold mt-0.5">
              Sepolia Smart Contracts
            </p>
          </div>

          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-2xs hover:border-emerald-200 transition-all">
            <div className="flex justify-between items-start">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Identity Status</span>
              <span className="text-lg">🛡️</span>
            </div>
            <p className="text-base font-extrabold text-slate-900 mt-2 truncate">
              {didInfo?.did ? "W3C Verified FPO" : "Pending DID"}
            </p>
            <p className="text-[11px] text-emerald-600 font-semibold mt-0.5">
              Role: FPO Organization
            </p>
          </div>
        </div>

        {/* ── DID & Trust Score Side-by-Side Grid ───────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <DidIdentityCard didInfo={didInfo} accentColor="blue" />
          <TrustReputationCard accentColor="blue" />
        </div>

        {/* ── Segmented Tab Navigation ──────────────────────────────── */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-1.5 shadow-2xs flex flex-wrap gap-1">
          <button
            type="button"
            className={`flex-1 min-w-[140px] py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === "farmer"
                ? "bg-blue-600 text-white shadow-sm"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
            }`}
            onClick={() => setActiveTab("farmer")}
          >
            <span>🌾</span>
            <span>Farmer Quotes (Procure)</span>
            {farmerQuotesCount > 0 && (
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                activeTab === "farmer" ? "bg-blue-700/80 text-white" : "bg-slate-100 text-slate-600"
              }`}>
                {farmerQuotesCount}
              </span>
            )}
          </button>

          <button
            type="button"
            className={`flex-1 min-w-[140px] py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === "retailer"
                ? "bg-blue-600 text-white shadow-sm"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
            }`}
            onClick={() => setActiveTab("retailer")}
          >
            <span>🛒</span>
            <span>Market Quotes (Sell)</span>
            {marketQuotesCount > 0 && (
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                activeTab === "retailer" ? "bg-blue-700/80 text-white" : "bg-slate-100 text-slate-600"
              }`}>
                {marketQuotesCount}
              </span>
            )}
          </button>

          <button
            type="button"
            className={`flex-1 min-w-[140px] py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === "escrow"
                ? "bg-amber-600 text-white shadow-sm"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
            }`}
            onClick={() => setActiveTab("escrow")}
          >
            <span>🔐</span>
            <span>Escrow Payments</span>
            {escrowsCount > 0 && (
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                activeTab === "escrow" ? "bg-amber-700/80 text-white" : "bg-slate-100 text-slate-600"
              }`}>
                {escrowsCount}
              </span>
            )}
          </button>
        </div>

        {/* ── Content Section Panels ─────────────────────────────────── */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs">
          {activeTab === "farmer" && (
            <div>
              <div className="mb-5 pb-3 border-b border-slate-100">
                <h2 className="text-base font-extrabold text-slate-900">
                  🌾 Farmer Supply Quotes Marketplace
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Browse open harvest lots published by verified farmers and place direct procurement bids
                </p>
              </div>
              <FarmerQuotes />
            </div>
          )}

          {activeTab === "retailer" && (
            <div>
              <div className="mb-5 pb-3 border-b border-slate-100">
                <h2 className="text-base font-extrabold text-slate-900">
                  🛒 Wholesale Market Quotes (Sell to Retailers)
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Publish aggregated crop lots to registered retailers and manage incoming procurement bids
                </p>
              </div>
              <RetailerQuotes />
            </div>
          )}

          {activeTab === "escrow" && (
            <div>
              <div className="mb-5 pb-3 border-b border-slate-100">
                <h2 className="text-base font-extrabold text-amber-900">
                  🔐 FPO Escrow Smart Contract Management
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Deposit ETH into verified escrow contracts and release payments to farmers upon delivery confirmation
                </p>
              </div>
              <FpoEscrowPanel />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
