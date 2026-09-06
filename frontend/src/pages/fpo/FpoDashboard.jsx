import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import Cookies from "js-cookie";
import { useNavigate } from "react-router-dom";
import { useRefreshSubscription } from "../../context/useRefresh";
import FarmerQuotes from "../../components/fpo/FarmerQuotes";
import RetailerQuotes from "../../components/fpo/RetailerQuotes";
import FpoEscrowPanel from "../../components/fpo/FpoEscrowPanel";
import FpoRetailerEscrowPanel from "../../components/fpo/FpoRetailerEscrowPanel";
import FpoInventoryPanel from "../../components/fpo/FpoInventoryPanel";
import FpoStockCartPanel from "../../components/fpo/FpoStockCartPanel";
import TrustReputationCard from "../../components/common/TrustReputationCard";
import DidIdentityCard from "../../components/common/DidIdentityCard";
import DashboardNavbar from "../../components/common/DashboardNavbar";

export default function FpoDashboard() {
  const [activeTab, setActiveTab] = useState("inventory");
  const [escrowSubTab, setEscrowSubTab] = useState("farmer");
  const navigate = useNavigate();
  const [didInfo, setDidInfo] = useState(null);
  const [farmerQuotesCount, setFarmerQuotesCount] = useState(0);
  const [marketQuotesCount, setMarketQuotesCount] = useState(0);
  const [escrowsCount, setEscrowsCount] = useState(0);
  const [cartItemsCount, setCartItemsCount] = useState(0);
  const [inventoryRefreshTrigger, setInventoryRefreshTrigger] = useState(0);
  const [showIdentity, setShowIdentity] = useState(false);

  const triggerInventoryRefresh = useCallback(() => {
    setInventoryRefreshTrigger((prev) => prev + 1);
  }, []);

  const fetchCartCount = useCallback(async () => {
    try {
      const res = await axios.get("/api/fpo/cart/", { withCredentials: true });
      setCartItemsCount(res.data?.summary?.total_items_count || 0);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchCartCount();
  }, [fetchCartCount]);

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

  useRefreshSubscription(
    ["fpo", "farmer", "retailer", "quotes", "bids", "deals", "inventory", "escrow"],
    () => {
      fetchCartCount();
      fetchDid();
      fetchOverviewMetrics();
    }
  );

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col text-slate-900 font-sans">
      {/* ── Top Header Navbar ───────────────────────────────────────── */}
      <DashboardNavbar
        role="fpo"
        userName={didInfo?.name || "FPO Organization"}
        didInfo={didInfo}
        onLogout={logout}
      />

      <div className="max-w-6xl mx-auto w-full px-3.5 sm:px-6 py-5 sm:py-8 flex-1 space-y-5 sm:space-y-6 min-w-0">

        {/* ── Welcome & Procurement Overview Banner ─────────────────── */}
        <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white rounded-2xl p-5 sm:p-7 shadow-lg relative overflow-hidden">
          <div className="absolute top-[-20%] right-[-10%] w-[40%] h-[140%] rounded-full bg-blue-500/10 blur-2xl pointer-events-none" />
          
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] sm:text-[11px] font-bold bg-blue-700/80 border border-blue-500/40 text-blue-100">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                  Farmer Producer Organization (FPO) Portal
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold tracking-tight">
                {didInfo?.name || "FPO Procurement Center"}
              </h1>
              <p className="text-xs sm:text-sm text-blue-100/80 max-w-xl">
                Aggregate agricultural supply from verified farmers, lock escrow funds on Sepolia, and supply wholesale crop lots to retail buyers.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => setActiveTab("farmer")}
                className="bg-blue-500 hover:bg-blue-400 text-slate-950 text-xs font-extrabold px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-xl transition-all shadow-md shadow-blue-950/30 flex items-center gap-1.5 cursor-pointer"
              >
                <span>🌾</span>
                <span>Procure from Farmers</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("retailer")}
                className="bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-xl transition-all shadow-md shadow-purple-900/30 flex items-center gap-1.5 cursor-pointer"
              >
                <span>🛒</span>
                <span>Publish Market Quote</span>
              </button>
            </div>
          </div>
        </div>

        {/* ── Summary Key Metrics Bar (Real Loaded Data Only) ─────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-2xs hover:border-blue-200 transition-all">
            <div className="flex justify-between items-start">
              <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-500">Farmer Quotes</span>
              <span className="text-base sm:text-lg">🌾</span>
            </div>
            <p className="text-xl sm:text-2xl font-extrabold text-slate-900 mt-1 tracking-tight">
              {farmerQuotesCount}
            </p>
            <p className="text-[10px] sm:text-[11px] text-blue-600 font-semibold mt-0.5 truncate">
              Available for Procurement
            </p>
          </div>

          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-2xs hover:border-purple-200 transition-all">
            <div className="flex justify-between items-start">
              <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-500">Market Quotes</span>
              <span className="text-base sm:text-lg">🛒</span>
            </div>
            <p className="text-xl sm:text-2xl font-extrabold text-slate-900 mt-1 tracking-tight">
              {marketQuotesCount}
            </p>
            <p className="text-[10px] sm:text-[11px] text-purple-600 font-semibold mt-0.5 truncate">
              Active Wholesale Lots
            </p>
          </div>

          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-2xs hover:border-amber-200 transition-all">
            <div className="flex justify-between items-start">
              <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-500">Active Escrows</span>
              <span className="text-base sm:text-lg">🔐</span>
            </div>
            <p className="text-xl sm:text-2xl font-extrabold text-slate-900 mt-1 tracking-tight">
              {escrowsCount}
            </p>
            <p className="text-[10px] sm:text-[11px] text-amber-600 font-semibold mt-0.5 truncate">
              Sepolia Smart Contracts
            </p>
          </div>
        </div>

        {/* ── Collapsible Organization Digital Identity & Trust Profile ── */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-3 sm:p-4 shadow-2xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <span className="text-2xl shrink-0">🏢</span>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs sm:text-sm font-extrabold text-slate-900 truncate">
                    {didInfo?.name || "FPO"} Organization Identity
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 shrink-0">
                    {didInfo?.did ? "W3C DID Verified" : "Pending DID"}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 font-mono truncate max-w-lg mt-0.5">
                  {didInfo?.did || "Decentralized Identifier"}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowIdentity(!showIdentity)}
              className="text-xs font-bold text-blue-700 hover:text-blue-800 px-3 py-1.5 rounded-xl border border-blue-200 hover:bg-blue-50/50 transition-all cursor-pointer shrink-0 self-start sm:self-auto"
            >
              {showIdentity ? "Hide Identity & Trust ▲" : "View Identity & Trust ▼"}
            </button>
          </div>

          {showIdentity && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4 pt-4 border-t border-slate-100">
              <DidIdentityCard didInfo={didInfo} accentColor="blue" />
              <TrustReputationCard accentColor="blue" />
            </div>
          )}
        </div>

        {/* ── Segmented Tab Navigation ──────────────────────────────── */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-1.5 shadow-2xs grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-1.5">
          <button
            type="button"
            className={`py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === "farmer"
                ? "bg-blue-600 text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
            }`}
            onClick={() => setActiveTab("farmer")}
          >
            <span>🌾</span>
            <span className="truncate">Farmer Market</span>
            {farmerQuotesCount > 0 && (
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] shrink-0 ${
                activeTab === "farmer" ? "bg-blue-700/80 text-white" : "bg-slate-100 text-slate-600"
              }`}>
                {farmerQuotesCount}
              </span>
            )}
          </button>

          <button
            type="button"
            className={`py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === "inventory"
                ? "bg-blue-600 text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
            }`}
            onClick={() => setActiveTab("inventory")}
          >
            <span>📦</span>
            <span className="truncate">Inventory</span>
          </button>

          <button
            type="button"
            className={`py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === "cart"
                ? "bg-purple-600 text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
            }`}
            onClick={() => setActiveTab("cart")}
          >
            <span>🛒</span>
            <span className="truncate">Stock Cart</span>
            {cartItemsCount > 0 && (
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] shrink-0 ${
                activeTab === "cart" ? "bg-purple-700/80 text-white" : "bg-purple-100 text-purple-700"
              }`}>
                {cartItemsCount}
              </span>
            )}
          </button>

          <button
            type="button"
            className={`py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === "retailer"
                ? "bg-blue-600 text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
            }`}
            onClick={() => setActiveTab("retailer")}
          >
            <span>🏪</span>
            <span className="truncate">Wholesale Market</span>
            {marketQuotesCount > 0 && (
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] shrink-0 ${
                activeTab === "retailer" ? "bg-blue-700/80 text-white" : "bg-slate-100 text-slate-600"
              }`}>
                {marketQuotesCount}
              </span>
            )}
          </button>

          <button
            type="button"
            className={`col-span-2 sm:col-span-1 py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === "escrow"
                ? "bg-amber-600 text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
            }`}
            onClick={() => setActiveTab("escrow")}
          >
            <span>🔐</span>
            <span className="truncate">Transactions</span>
            {escrowsCount > 0 && (
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] shrink-0 ${
                activeTab === "escrow" ? "bg-amber-700/80 text-white" : "bg-slate-100 text-slate-600"
              }`}>
                {escrowsCount}
              </span>
            )}
          </button>
        </div>

        {/* ── Content Section Panels ─────────────────────────────────── */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-6 shadow-xs min-w-0">
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
              <FarmerQuotes onBidPlaced={fetchOverviewMetrics} />
            </div>
          )}

          {activeTab === "inventory" && (
            <FpoInventoryPanel 
              onCartUpdated={() => {
                fetchCartCount();
                fetchOverviewMetrics();
              }}
              refreshTrigger={inventoryRefreshTrigger} 
            />
          )}

          {activeTab === "cart" && (
            <FpoStockCartPanel 
              onCartUpdated={() => {
                fetchCartCount();
                fetchOverviewMetrics();
                triggerInventoryRefresh();
              }}
              onQuotePublished={() => {
                fetchCartCount();
                fetchOverviewMetrics();
                triggerInventoryRefresh();
              }}
            />
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
              <RetailerQuotes 
                onNavigateToCart={() => setActiveTab("cart")}
                onBidAccepted={fetchOverviewMetrics}
                onQuoteCreated={fetchOverviewMetrics}
              />
            </div>
          )}

          {activeTab === "escrow" && (
            <div className="space-y-5">
              <div className="pb-3 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-extrabold text-amber-900">
                    🔐 Smart Contract Escrow Payments
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Trustless Sepolia smart-contract escrow payments for Farmer procurement and Retail commercial sales
                  </p>
                </div>

                <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setEscrowSubTab("farmer")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      escrowSubTab === "farmer"
                        ? "bg-white text-slate-900 shadow-2xs"
                        : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    🌾 Farmer Procurement
                  </button>
                  <button
                    type="button"
                    onClick={() => setEscrowSubTab("retailer")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      escrowSubTab === "retailer"
                        ? "bg-white text-purple-900 shadow-2xs"
                        : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    🏢 Retail Wholesale Deals
                  </button>
                </div>
              </div>

              {escrowSubTab === "farmer" ? (
                <FpoEscrowPanel
                  onEscrowUpdated={() => {
                    fetchOverviewMetrics();
                    triggerInventoryRefresh();
                  }}
                />
              ) : (
                <FpoRetailerEscrowPanel
                  onEscrowUpdated={fetchOverviewMetrics}
                />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
