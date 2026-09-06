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
import TrustReputationCard from "../../components/common/TrustReputationCard";
import DidIdentityCard from "../../components/common/DidIdentityCard";
import DashboardNavbar from "../../components/common/DashboardNavbar";

// activeNav values: "dashboard" | "farmer_market" | "inventory" | "retailer_market" | "deals" | "transactions" | "identity"

export default function FpoDashboard() {
  const [activeNav, setActiveNav] = useState("dashboard");
  const [escrowSubTab, setEscrowSubTab] = useState("farmer");
  const navigate = useNavigate();
  const [didInfo, setDidInfo] = useState(null);
  const [farmerQuotesCount, setFarmerQuotesCount] = useState(0);
  const [marketQuotesCount, setMarketQuotesCount] = useState(0);
  const [escrowsCount, setEscrowsCount] = useState(0);
  const [cartItemsCount, setCartItemsCount] = useState(0);
  const [inventoryRefreshTrigger, setInventoryRefreshTrigger] = useState(0);

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

      <div className="max-w-6xl mx-auto w-full px-3.5 sm:px-6 py-5 sm:py-7 flex-1 space-y-5 min-w-0">

        {/* ── Role Navigation Bar ────────────────────────────────────── */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-1.5 shadow-2xs flex items-center justify-between gap-1 overflow-x-auto">
          <div className="flex items-center gap-1 min-w-max">
            <button
              type="button"
              onClick={() => setActiveNav("dashboard")}
              className={`py-2 px-3 sm:px-4 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeNav === "dashboard"
                  ? "bg-blue-600 text-white shadow-2xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
              }`}
            >
              <span>🏢</span>
              <span>Dashboard</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveNav("farmer_market")}
              className={`py-2 px-3 sm:px-4 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeNav === "farmer_market"
                  ? "bg-blue-600 text-white shadow-2xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
              }`}
            >
              <span>🌾</span>
              <span>Farmer Market</span>
              {farmerQuotesCount > 0 && (
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                  activeNav === "farmer_market" ? "bg-blue-700/80 text-white" : "bg-slate-100 text-slate-600"
                }`}>
                  {farmerQuotesCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveNav("inventory")}
              className={`py-2 px-3 sm:px-4 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeNav === "inventory"
                  ? "bg-blue-600 text-white shadow-2xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
              }`}
            >
              <span>📦</span>
              <span>Inventory</span>
              {cartItemsCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-purple-100 text-purple-800 font-bold">
                  {cartItemsCount} in cart
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveNav("retailer_market")}
              className={`py-2 px-3 sm:px-4 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeNav === "retailer_market"
                  ? "bg-blue-600 text-white shadow-2xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
              }`}
            >
              <span>🛒</span>
              <span>Retailer Market</span>
              {marketQuotesCount > 0 && (
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                  activeNav === "retailer_market" ? "bg-blue-700/80 text-white" : "bg-slate-100 text-slate-600"
                }`}>
                  {marketQuotesCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveNav("deals")}
              className={`py-2 px-3 sm:px-4 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeNav === "deals"
                  ? "bg-blue-600 text-white shadow-2xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
              }`}
            >
              <span>🤝</span>
              <span>Deals</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveNav("transactions")}
              className={`py-2 px-3 sm:px-4 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeNav === "transactions"
                  ? "bg-blue-600 text-white shadow-2xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
              }`}
            >
              <span>🔐</span>
              <span>Transactions</span>
              {escrowsCount > 0 && (
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                  activeNav === "transactions" ? "bg-blue-700/80 text-white" : "bg-slate-100 text-slate-600"
                }`}>
                  {escrowsCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveNav("identity")}
              className={`py-2 px-3 sm:px-4 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeNav === "identity"
                  ? "bg-blue-600 text-white shadow-2xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
              }`}
            >
              <span>🪪</span>
              <span>Identity</span>
            </button>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════ */}
        {/* VIEW 1: DASHBOARD (Operations / Procurement Center)           */}
        {/* ══════════════════════════════════════════════════════════════ */}
        {activeNav === "dashboard" && (
          <div className="space-y-5 animate-fade-in">
            {/* Operational Header */}
            <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-6 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse shrink-0" />
                  <span className="text-[11px] font-bold text-blue-700 uppercase tracking-wider">
                    FPO Operations & Procurement Center
                  </span>
                </div>
                <h1 className="text-lg sm:text-2xl font-extrabold text-slate-900 tracking-tight truncate">
                  {didInfo?.name || "FPO Organization Portal"}
                </h1>
                <p className="text-xs text-slate-500 max-w-xl">
                  Aggregate agricultural supply from verified farmers, verify quality, and manage wholesale B2B distribution.
                </p>
              </div>

              {/* Quick Actions */}
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setActiveNav("farmer_market")}
                  className="px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <span>🌾</span>
                  <span>Procure Crops</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveNav("retailer_market")}
                  className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <span>🛒</span>
                  <span>Publish Offer</span>
                </button>
              </div>
            </div>

            {/* Visual Procurement Flow: Farmer → FPO → Retailer */}
            <div className="bg-white border border-slate-200/80 rounded-2xl p-3.5 sm:p-4 shadow-2xs">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block mb-2">
                Supply Chain Operations Pipeline
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                <div className="bg-emerald-50/50 border border-emerald-200/80 rounded-xl p-3 flex items-center gap-3">
                  <span className="text-2xl shrink-0">🌾</span>
                  <div className="min-w-0">
                    <span className="text-[10px] font-bold text-emerald-800 uppercase block">1. Farmer Supply</span>
                    <span className="font-extrabold text-slate-900 truncate block">
                      {farmerQuotesCount} Lots Available
                    </span>
                  </div>
                </div>

                <div className="bg-blue-50/50 border border-blue-200/80 rounded-xl p-3 flex items-center gap-3">
                  <span className="text-2xl shrink-0">🏢</span>
                  <div className="min-w-0">
                    <span className="text-[10px] font-bold text-blue-800 uppercase block">2. FPO Aggregation</span>
                    <span className="font-extrabold text-slate-900 truncate block">
                      Traceable Inventory Stock
                    </span>
                  </div>
                </div>

                <div className="bg-purple-50/50 border border-purple-200/80 rounded-xl p-3 flex items-center gap-3">
                  <span className="text-2xl shrink-0">🏪</span>
                  <div className="min-w-0">
                    <span className="text-[10px] font-bold text-purple-800 uppercase block">3. Retailer Distribution</span>
                    <span className="font-extrabold text-slate-900 truncate block">
                      {marketQuotesCount} Wholesale Lots
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* 4 Operations Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-white border border-slate-200/80 rounded-2xl p-3.5 shadow-2xs hover:border-blue-200 transition-all min-w-0">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block truncate">
                  🌾 Farmer Supply
                </span>
                <p className="text-xl sm:text-2xl font-extrabold text-slate-900 mt-1 font-mono tracking-tight truncate">
                  {farmerQuotesCount}
                </p>
                <p className="text-[11px] text-blue-600 font-semibold mt-0.5 truncate">
                  Available for Bidding
                </p>
              </div>

              <div className="bg-white border border-slate-200/80 rounded-2xl p-3.5 shadow-2xs hover:border-emerald-200 transition-all min-w-0">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block truncate">
                  📦 In-Stock Lots
                </span>
                <p className="text-xl sm:text-2xl font-extrabold text-slate-900 mt-1 font-mono tracking-tight truncate">
                  {cartItemsCount}
                </p>
                <p className="text-[11px] text-emerald-600 font-semibold mt-0.5 truncate">
                  Allocated in Cart
                </p>
              </div>

              <div className="bg-white border border-slate-200/80 rounded-2xl p-3.5 shadow-2xs hover:border-purple-200 transition-all min-w-0">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block truncate">
                  🛒 Retailer Offers
                </span>
                <p className="text-xl sm:text-2xl font-extrabold text-slate-900 mt-1 font-mono tracking-tight truncate">
                  {marketQuotesCount}
                </p>
                <p className="text-[11px] text-purple-600 font-semibold mt-0.5 truncate">
                  Active Wholesale Lots
                </p>
              </div>

              <div className="bg-white border border-slate-200/80 rounded-2xl p-3.5 shadow-2xs hover:border-amber-200 transition-all min-w-0">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block truncate">
                  🤝 Active Deals
                </span>
                <p className="text-xl sm:text-2xl font-extrabold text-slate-900 mt-1 font-mono tracking-tight truncate">
                  {escrowsCount}
                </p>
                <p className="text-[11px] text-amber-600 font-semibold mt-0.5 truncate">
                  Sepolia Escrows
                </p>
              </div>
            </div>

            {/* Quick Procurement Launchpad */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-2xs space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">🌾</span>
                    <h3 className="text-sm font-extrabold text-slate-900">Procure from Verified Farmers</h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveNav("farmer_market")}
                    className="text-xs font-bold text-blue-600 hover:text-blue-700"
                  >
                    Open Market →
                  </button>
                </div>
                <p className="text-xs text-slate-500">
                  Browse harvest lots published by local verified farmers. Review Gemini AI crop grades and submit procurement bids.
                </p>
                <button
                  type="button"
                  onClick={() => setActiveNav("farmer_market")}
                  className="w-full py-2 bg-blue-50 hover:bg-blue-100 text-blue-800 text-xs font-bold rounded-xl border border-blue-200 transition-all cursor-pointer"
                >
                  Browse Open Farmer Quotes ({farmerQuotesCount})
                </button>
              </div>

              <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-2xs space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">🛒</span>
                    <h3 className="text-sm font-extrabold text-slate-900">Supply Wholesale to Retailers</h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveNav("retailer_market")}
                    className="text-xs font-bold text-purple-600 hover:text-purple-700"
                  >
                    Manage Offers →
                  </button>
                </div>
                <p className="text-xs text-slate-500">
                  Aggregate farmer lots into commercial wholesale offers. Review incoming bids from verified commercial retailers.
                </p>
                <button
                  type="button"
                  onClick={() => setActiveNav("retailer_market")}
                  className="w-full py-2 bg-purple-50 hover:bg-purple-100 text-purple-800 text-xs font-bold rounded-xl border border-purple-200 transition-all cursor-pointer"
                >
                  Manage Wholesale Offers ({marketQuotesCount})
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════ */}
        {/* VIEW 2: FARMER MARKET (Procurement)                           */}
        {/* ══════════════════════════════════════════════════════════════ */}
        {activeNav === "farmer_market" && (
          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-6 shadow-2xs space-y-4 animate-fade-in">
            <div className="pb-3 border-b border-slate-100">
              <h2 className="text-base font-extrabold text-slate-900">
                🌾 Farmer Supply Procurement Marketplace
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Browse open harvest lots published by verified farmers and submit direct procurement bids
              </p>
            </div>

            <FarmerQuotes onBidPlaced={fetchOverviewMetrics} />
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════ */}
        {/* VIEW 3: INVENTORY & STOCK                                     */}
        {/* ══════════════════════════════════════════════════════════════ */}
        {activeNav === "inventory" && (
          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-6 shadow-2xs space-y-4 animate-fade-in">
            <div className="pb-3 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-base font-extrabold text-slate-900">
                  📦 FPO Aggregated Stock Inventory
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Traceable inventory acquired from farmers — retains permanent provenance per lot
                </p>
              </div>

              <button
                type="button"
                onClick={() => setActiveNav("retailer_market")}
                className="px-3.5 py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer flex items-center gap-1"
              >
                <span>🛒</span>
                <span>Wholesale Offers</span>
              </button>
            </div>

            <FpoInventoryPanel
              onCartUpdated={() => {
                fetchCartCount();
                fetchOverviewMetrics();
              }}
              refreshTrigger={inventoryRefreshTrigger}
            />
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════ */}
        {/* VIEW 4: RETAILER MARKET (Wholesale Sales)                     */}
        {/* ══════════════════════════════════════════════════════════════ */}
        {activeNav === "retailer_market" && (
          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-6 shadow-2xs space-y-4 animate-fade-in">
            <div className="pb-3 border-b border-slate-100">
              <h2 className="text-base font-extrabold text-slate-900">
                🛒 Wholesale Market Quotes (Sell to Retailers)
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Publish aggregated crop lots to registered retailers and manage incoming procurement bids
              </p>
            </div>

            <RetailerQuotes
              onNavigateToCart={() => setActiveNav("inventory")}
              onBidAccepted={fetchOverviewMetrics}
              onQuoteCreated={fetchOverviewMetrics}
            />
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════ */}
        {/* VIEW 5: DEALS                                                 */}
        {/* ══════════════════════════════════════════════════════════════ */}
        {activeNav === "deals" && (
          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-6 shadow-2xs space-y-4 animate-fade-in">
            <div className="pb-3 border-b border-slate-100">
              <h2 className="text-base font-extrabold text-slate-900">
                🤝 Commercial Deals & Active Negotiations
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Manage ongoing bilateral negotiations across farmer procurement and retail sales
              </p>
            </div>

            <RetailerQuotes
              onNavigateToCart={() => setActiveNav("inventory")}
              onBidAccepted={fetchOverviewMetrics}
              onQuoteCreated={fetchOverviewMetrics}
            />
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════ */}
        {/* VIEW 6: TRANSACTIONS & ESCROW                                 */}
        {/* ══════════════════════════════════════════════════════════════ */}
        {activeNav === "transactions" && (
          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-6 shadow-2xs space-y-5 animate-fade-in">
            <div className="pb-3 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-extrabold text-slate-900">
                  🔐 Smart Contract Escrow Transactions
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Ethereum Sepolia smart-contract escrow payments for Farmer procurement and Retail commercial sales
                </p>
              </div>

              <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
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

        {/* ══════════════════════════════════════════════════════════════ */}
        {/* VIEW 7: IDENTITY & VERIFICATION                               */}
        {/* ══════════════════════════════════════════════════════════════ */}
        {activeNav === "identity" && (
          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-6 shadow-2xs space-y-5 animate-fade-in">
            <div className="pb-3 border-b border-slate-100">
              <h2 className="text-base font-extrabold text-slate-900">
                🪪 Organization Identity & Trust Profile
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Verified W3C Decentralized Identifier (DID) and on-chain operational trust tier
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <DidIdentityCard didInfo={didInfo} accentColor="blue" />
              <TrustReputationCard accentColor="blue" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
