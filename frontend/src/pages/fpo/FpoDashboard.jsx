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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [dealsDirection, setDealsDirection] = useState("buying"); // "buying" | "selling"
  const [escrowSubTab, setEscrowSubTab] = useState("farmer"); // "farmer" | "retailer"
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

  const navItems = [
    { key: "dashboard", label: "Dashboard", icon: "🏠" },
    {
      key: "farmer_market",
      label: "Farmer Market",
      icon: "🌾",
      badge: farmerQuotesCount > 0 ? farmerQuotesCount : null,
    },
    {
      key: "inventory",
      label: "Inventory",
      icon: "📦",
      badge: cartItemsCount > 0 ? `${cartItemsCount} in cart` : null,
    },
    {
      key: "retailer_market",
      label: "Retailer Market",
      icon: "🛒",
      badge: marketQuotesCount > 0 ? marketQuotesCount : null,
    },
    {
      key: "deals",
      label: "Deals",
      icon: "🤝",
    },
    {
      key: "transactions",
      label: "Transactions",
      icon: "💰",
      badge: escrowsCount > 0 ? escrowsCount : null,
    },
    { key: "identity", label: "Identity", icon: "🪪" },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col text-slate-900 font-sans">
      {/* ── Top Header Navbar ───────────────────────────────────────── */}
      <DashboardNavbar
        role="fpo"
        userName={didInfo?.name || "FPO Organization"}
        didInfo={didInfo}
        onLogout={logout}
        onToggleMobileMenu={() => setIsMobileMenuOpen((prev) => !prev)}
      />

      {/* ── Application Layout Shell (Sidebar + Main Content) ─────────── */}
      <div className="flex flex-1 w-full max-w-7xl mx-auto min-w-0">
        {/* ── Desktop Left Sidebar (~240px) ─────────────────────────── */}
        <aside className="hidden lg:flex flex-col w-60 xl:w-64 shrink-0 bg-white border-r border-slate-200/80 p-4 space-y-4 sticky top-14 h-[calc(100vh-3.5rem)]">
          {/* Operations Center Badge */}
          <div className="px-3 py-2 bg-blue-50/70 border border-blue-200/60 rounded-xl flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse shrink-0" />
            <span className="text-[11px] font-bold text-blue-800 uppercase tracking-wider truncate">
              Procurement Center
            </span>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1 flex-1">
            {navItems.map((item) => {
              const isActive = activeNav === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setActiveNav(item.key)}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                    isActive
                      ? "bg-blue-600 text-white font-bold shadow-xs"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                  }`}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <span className="text-base">{item.icon}</span>
                    <span className="truncate">{item.label}</span>
                  </div>
                  {item.badge !== null && (
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        isActive
                          ? "bg-blue-700/80 text-white"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Sidebar Action Button */}
          <div className="pt-3 border-t border-slate-100 space-y-2">
            <button
              type="button"
              onClick={() => setActiveNav("farmer_market")}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <span>🌾</span>
              <span>Procure Crops</span>
            </button>
          </div>
        </aside>

        {/* ── Mobile Slide-Over Drawer ──────────────────────────────── */}
        {isMobileMenuOpen && (
          <div className="fixed inset-0 z-50 lg:hidden flex">
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
              onClick={() => setIsMobileMenuOpen(false)}
            />

            {/* Drawer Container */}
            <div className="relative w-72 max-w-[80vw] bg-white h-full shadow-2xl p-5 flex flex-col justify-between z-10 animate-fade-in">
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">🏢</span>
                    <span className="font-bold text-sm text-slate-900">Procurement Center</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
                  >
                    ✕
                  </button>
                </div>

                <nav className="space-y-1">
                  {navItems.map((item) => {
                    const isActive = activeNav === item.key;
                    return (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => {
                          setActiveNav(item.key);
                          setIsMobileMenuOpen(false);
                        }}
                        className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                          isActive
                            ? "bg-blue-600 text-white font-bold shadow-xs"
                            : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 truncate">
                          <span className="text-base">{item.icon}</span>
                          <span>{item.label}</span>
                        </div>
                        {item.badge !== null && (
                          <span
                            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                              isActive
                                ? "bg-blue-700/80 text-white"
                                : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {item.badge}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </nav>
              </div>

              <div className="pt-4 border-t border-slate-100 space-y-2">
                <button
                  type="button"
                  onClick={() => {
                    setActiveNav("farmer_market");
                    setIsMobileMenuOpen(false);
                  }}
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white px-4 py-2.5 rounded-xl text-xs font-semibold transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>🌾</span>
                  <span>Browse Farmer Supply</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Main Content Area ─────────────────────────────────────── */}
        <main className="flex-1 min-w-0 p-3.5 sm:p-6 lg:p-7 space-y-5">
          {/* Mobile Quick Tab Navigation */}
          <div className="lg:hidden bg-white border border-slate-200/80 rounded-2xl p-1.5 shadow-2xs flex items-center justify-between gap-1 overflow-x-auto">
            {navItems.map((item) => {
              const isActive = activeNav === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setActiveNav(item.key)}
                  className={`py-2 px-3 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
                    isActive
                      ? "bg-blue-600 text-white font-bold shadow-2xs"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                  }`}
                >
                  <span>{item.icon}</span>
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>

          {/* ══════════════════════════════════════════════════════════════ */}
          {/* VIEW 1: DASHBOARD (FPO Operations Homepage)                   */}
          {/* ══════════════════════════════════════════════════════════════ */}
          {activeNav === "dashboard" && (
            <div className="space-y-5 animate-fade-in">
              {/* Clean FPO Operations Header */}
              <div className="bg-white border border-slate-200/80 rounded-3xl p-5 sm:p-6 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1 min-w-0">
                  <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight truncate">
                    FPO Operations
                  </h1>
                  <p className="text-xs sm:text-sm text-slate-500">
                    Manage farmer supply, inventory and retailer sales.
                  </p>
                </div>

                {/* 3 Prominent Quick Actions */}
                <div className="flex items-center gap-2 shrink-0 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setActiveNav("farmer_market")}
                    className="px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>🌾</span>
                    <span>Browse Farmer Supply</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveNav("inventory")}
                    className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <span>📦</span>
                    <span>View Inventory</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveNav("retailer_market")}
                    className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>🛒</span>
                    <span>Sell to Retailers</span>
                  </button>
                </div>
              </div>

              {/* 4 Compact Summary Metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-white border border-slate-200/80 rounded-2xl p-3.5 shadow-2xs hover:border-blue-200 transition-all min-w-0">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 block truncate">
                    🌾 Farmer Supply
                  </span>
                  <p className="text-xl sm:text-2xl font-bold text-slate-900 mt-1 font-mono tracking-tight truncate">
                    {farmerQuotesCount}
                  </p>
                  <p className="text-[11px] text-blue-700 font-medium mt-0.5 truncate">
                    Available for Bidding
                  </p>
                </div>

                <div className="bg-white border border-slate-200/80 rounded-2xl p-3.5 shadow-2xs hover:border-emerald-200 transition-all min-w-0">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 block truncate">
                    📦 Inventory
                  </span>
                  <p className="text-xl sm:text-2xl font-bold text-slate-900 mt-1 font-mono tracking-tight truncate">
                    {cartItemsCount}
                  </p>
                  <p className="text-[11px] text-emerald-700 font-medium mt-0.5 truncate">
                    Lots Allocated in Cart
                  </p>
                </div>

                <div className="bg-white border border-slate-200/80 rounded-2xl p-3.5 shadow-2xs hover:border-amber-200 transition-all min-w-0">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 block truncate">
                    🤝 Active Deals
                  </span>
                  <p className="text-xl sm:text-2xl font-bold text-slate-900 mt-1 font-mono tracking-tight truncate">
                    {escrowsCount}
                  </p>
                  <p className="text-[11px] text-amber-700 font-medium mt-0.5 truncate">
                    Sepolia Escrows
                  </p>
                </div>

                <div className="bg-white border border-slate-200/80 rounded-2xl p-3.5 shadow-2xs hover:border-purple-200 transition-all min-w-0">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 block truncate">
                    🛒 Retailer Offers
                  </span>
                  <p className="text-xl sm:text-2xl font-bold text-slate-900 mt-1 font-mono tracking-tight truncate">
                    {marketQuotesCount}
                  </p>
                  <p className="text-[11px] text-purple-700 font-medium mt-0.5 truncate">
                    Published Wholesale Lots
                  </p>
                </div>
              </div>

              {/* Supply Chain Operations Pipeline Tracker */}
              <div className="bg-white border border-slate-200/80 rounded-3xl p-4 sm:p-5 shadow-2xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-2.5">
                  Supply Chain Operations Pipeline
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                  <div className="bg-emerald-50/50 border border-emerald-200/80 rounded-xl p-3 flex items-center gap-3">
                    <span className="text-2xl shrink-0">🌾</span>
                    <div className="min-w-0">
                      <span className="text-[10px] font-bold text-emerald-800 uppercase block">1. Farmer Supply</span>
                      <span className="font-bold text-slate-900 truncate block">
                        {farmerQuotesCount} Lots Available
                      </span>
                    </div>
                  </div>

                  <div className="bg-blue-50/50 border border-blue-200/80 rounded-xl p-3 flex items-center gap-3">
                    <span className="text-2xl shrink-0">🏢</span>
                    <div className="min-w-0">
                      <span className="text-[10px] font-bold text-blue-800 uppercase block">2. FPO Aggregation</span>
                      <span className="font-bold text-slate-900 truncate block">
                        Traceable Inventory Stock
                      </span>
                    </div>
                  </div>

                  <div className="bg-purple-50/50 border border-purple-200/80 rounded-xl p-3 flex items-center gap-3">
                    <span className="text-2xl shrink-0">🏪</span>
                    <div className="min-w-0">
                      <span className="text-[10px] font-bold text-purple-800 uppercase block">3. Retailer Distribution</span>
                      <span className="font-bold text-slate-900 truncate block">
                        {marketQuotesCount} Wholesale Lots
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Compact Overview Sections */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 1. Recent Farmer Supply */}
                <div className="bg-white border border-slate-200/80 rounded-3xl p-5 shadow-2xs space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <span className="text-base">🌾</span>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                        Farmer Supply
                      </h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveNav("farmer_market")}
                      className="text-xs font-semibold text-blue-600 hover:text-blue-700 cursor-pointer"
                    >
                      View All ({farmerQuotesCount}) →
                    </button>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Review open harvest lots from verified local farmers and submit direct procurement bids.
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveNav("farmer_market")}
                    className="w-full py-2 bg-blue-50 hover:bg-blue-100 text-blue-800 text-xs font-semibold rounded-xl border border-blue-200 transition-all cursor-pointer"
                  >
                    Open Farmer Procurement Market
                  </button>
                </div>

                {/* 2. Retailer Opportunities */}
                <div className="bg-white border border-slate-200/80 rounded-3xl p-5 shadow-2xs space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <span className="text-base">🛒</span>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                        Retailer Opportunities
                      </h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveNav("retailer_market")}
                      className="text-xs font-semibold text-blue-600 hover:text-blue-700 cursor-pointer"
                    >
                      View All ({marketQuotesCount}) →
                    </button>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Aggregate acquired harvest lots into wholesale lots and receive bids from commercial retailers.
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveNav("retailer_market")}
                    className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-xl border border-slate-200 transition-all cursor-pointer"
                  >
                    Manage Wholesale Offers
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════ */}
          {/* VIEW 2: FARMER MARKET (Procurement)                           */}
          {/* ══════════════════════════════════════════════════════════════ */}
          {activeNav === "farmer_market" && (
            <div className="bg-white border border-slate-200/80 rounded-3xl p-5 sm:p-7 shadow-2xs space-y-5 animate-fade-in">
              <div className="pb-3 border-b border-slate-100">
                <h2 className="text-base sm:text-lg font-bold text-slate-900">
                  🌾 Farmer Market
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Find verified crops available for procurement.
                </p>
              </div>

              <FarmerQuotes onBidPlaced={fetchOverviewMetrics} />
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════ */}
          {/* VIEW 3: INVENTORY                                             */}
          {/* ══════════════════════════════════════════════════════════════ */}
          {activeNav === "inventory" && (
            <div className="bg-white border border-slate-200/80 rounded-3xl p-5 sm:p-7 shadow-2xs space-y-5 animate-fade-in">
              <div className="pb-3 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-slate-900">
                    📦 FPO Inventory Stock
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Stock you currently control — retains 100% individual farmer lot allocations and provenance.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setActiveNav("retailer_market")}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl transition-all shadow-xs cursor-pointer flex items-center gap-1.5 self-start sm:self-auto"
                >
                  <span>🛒</span>
                  <span>Sell to Retailers</span>
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
          {/* VIEW 4: RETAILER MARKET (Selling to Retailers)                */}
          {/* ══════════════════════════════════════════════════════════════ */}
          {activeNav === "retailer_market" && (
            <div className="bg-white border border-slate-200/80 rounded-3xl p-5 sm:p-7 shadow-2xs space-y-5 animate-fade-in">
              <div className="pb-3 border-b border-slate-100">
                <h2 className="text-base sm:text-lg font-bold text-slate-900">
                  🛒 Retailer Market
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Create offers from your available inventory.
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
          {/* VIEW 5: DEALS (Dual-Direction Deals Workspace)                */}
          {/* ══════════════════════════════════════════════════════════════ */}
          {activeNav === "deals" && (
            <div className="bg-white border border-slate-200/80 rounded-3xl p-5 sm:p-7 shadow-2xs space-y-5 animate-fade-in">
              <div className="pb-3 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-slate-900">
                    🤝 Commercial Deals Workspace
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Manage bilateral negotiations across farmer procurement and retailer wholesale sales.
                  </p>
                </div>

                {/* Clear Dual-Direction Tabs */}
                <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl shrink-0 self-start sm:self-auto">
                  <button
                    type="button"
                    onClick={() => setDealsDirection("buying")}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      dealsDirection === "buying"
                        ? "bg-white text-slate-900 shadow-2xs font-bold"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    🌾 Buying from Farmers
                  </button>
                  <button
                    type="button"
                    onClick={() => setDealsDirection("selling")}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      dealsDirection === "selling"
                        ? "bg-white text-blue-900 shadow-2xs font-bold"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    🛒 Selling to Retailers
                  </button>
                </div>
              </div>

              {dealsDirection === "buying" ? (
                <div className="space-y-4">
                  <div className="p-3 bg-blue-50/50 border border-blue-200/60 rounded-xl text-xs text-slate-700">
                    Viewing procurement quotes and active offers placed with local farmers.
                  </div>
                  <FarmerQuotes onBidPlaced={fetchOverviewMetrics} />
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="p-3 bg-purple-50/50 border border-purple-200/60 rounded-xl text-xs text-slate-700">
                    Viewing published wholesale lots and incoming purchase bids from commercial retailers.
                  </div>
                  <RetailerQuotes
                    onNavigateToCart={() => setActiveNav("inventory")}
                    onBidAccepted={fetchOverviewMetrics}
                    onQuoteCreated={fetchOverviewMetrics}
                  />
                </div>
              )}
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════ */}
          {/* VIEW 6: TRANSACTIONS & ESCROW                                 */}
          {/* ══════════════════════════════════════════════════════════════ */}
          {activeNav === "transactions" && (
            <div className="bg-white border border-slate-200/80 rounded-3xl p-5 sm:p-7 shadow-2xs space-y-5 animate-fade-in">
              <div className="pb-3 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-slate-900">
                    💰 Transactions & Escrow Settlement
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Ethereum Sepolia smart-contract escrow payments for Farmer procurement and Retail commercial sales.
                  </p>
                </div>

                <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl shrink-0 self-start sm:self-auto">
                  <button
                    type="button"
                    onClick={() => setEscrowSubTab("farmer")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      escrowSubTab === "farmer"
                        ? "bg-white text-slate-900 shadow-2xs font-bold"
                        : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    🌾 Farmer Procurement
                  </button>
                  <button
                    type="button"
                    onClick={() => setEscrowSubTab("retailer")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      escrowSubTab === "retailer"
                        ? "bg-white text-blue-900 shadow-2xs font-bold"
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
            <div className="bg-white border border-slate-200/80 rounded-3xl p-5 sm:p-7 shadow-2xs space-y-5 animate-fade-in">
              <div className="pb-3 border-b border-slate-100">
                <h2 className="text-base sm:text-lg font-bold text-slate-900">
                  🪪 Identity & Trust Profile
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Verified W3C Decentralized Identifier (DID) and operational trust profile.
                </p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <DidIdentityCard didInfo={didInfo} accentColor="blue" />
                <TrustReputationCard accentColor="blue" />
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
