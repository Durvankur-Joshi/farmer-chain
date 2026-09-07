import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import Cookies from "js-cookie";
import { useNavigate } from "react-router-dom";
import { useRefresh, useRefreshSubscription } from "../../context/useRefresh";
import TrustReputationCard from "../../components/common/TrustReputationCard";
import DidIdentityCard from "../../components/common/DidIdentityCard";
import DashboardNavbar from "../../components/common/DashboardNavbar";
import StatusBadge from "../../components/common/StatusBadge";
import { formatCommercialPrice, formatSettlementBreakdown } from "../../utils/pricing";
import MarketplaceFilterBar from "../../components/common/MarketplaceFilterBar";
import RetailerEscrowPanel from "../../components/retailer/RetailerEscrowPanel";
import RetailerCartPanel from "../../components/retailer/RetailerCartPanel";
import RetailerOrdersPanel from "../../components/retailer/RetailerOrdersPanel";
import RetailerInventoryPanel from "../../components/retailer/RetailerInventoryPanel";
import NegotiationModal from "../../components/common/NegotiationModal";
import ProvenanceCard from "../../components/common/ProvenanceCard";
import BaseModal from "../../components/common/BaseModal";
import AddressCopy from "../../components/common/AddressCopy";

// activeNav values: "dashboard" | "market" | "deals" | "cart" | "inventory" | "transactions" | "identity"

export default function RetailerDashboard() {
  const { refresh } = useRefresh();
  const navigate = useNavigate();

  const [activeNav, setActiveNav] = useState("dashboard");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [fpoQuotes, setFpoQuotes] = useState([]);
  const [quotesLoading, setQuotesLoading] = useState(true);
  const [myBids, setMyBids] = useState([]);
  const [bidsLoading, setBidsLoading] = useState(true);
  const [didInfo, setDidInfo] = useState(null);
  const [currentFilters, setCurrentFilters] = useState({});
  const [negotiatingBid, setNegotiatingBid] = useState(null);

  // Cart & Order state
  const [cartCount, setCartCount] = useState(0);
  const [cartQuantities, setCartQuantities] = useState({});
  const [addingToCartMap, setAddingToCartMap] = useState({});
  // Overview counts
  const [inventoryCount, setInventoryCount] = useState(0);
  const [escrowsCount, setEscrowsCount] = useState(0);

  // Product Details Modal
  const [activeProductModal, setActiveProductModal] = useState(null);
  const [showBlockchainDetails, setShowBlockchainDetails] = useState(false);

  // Bidding Modal State
  const [activeBidQuote, setActiveBidQuote] = useState(null);
  const [bidAmountInput, setBidAmountInput] = useState("");
  const [bidDaysInput, setBidDaysInput] = useState("3");
  const [bidSubmitting, setBidSubmitting] = useState(false);
  const [bidStatusMsg, setBidStatusMsg] = useState(null);

  const retailerId = Cookies.get("retailer_id");

  // 🔹 Logout
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

  const fetchCartCount = useCallback(async () => {
    try {
      const res = await axios.get("/api/retailer/cart/", { withCredentials: true });
      setCartCount(res.data?.summary?.total_items_count || 0);
    } catch (err) {
      console.error("Could not fetch cart count:", err);
    }
  }, []);

  const handleCartQuantityChange = (quoteId, value) => {
    setCartQuantities((prev) => ({ ...prev, [quoteId]: value }));
  };

  const handleAddToCart = async (quote) => {
    const selectedQty = cartQuantities[quote.id] ?? (quote.available_quantity || quote.quantity);
    const qtyVal = parseFloat(selectedQty);
    if (isNaN(qtyVal) || qtyVal <= 0) {
      alert("⚠️ Please enter a valid positive quantity greater than 0.");
      return;
    }

    setAddingToCartMap((prev) => ({ ...prev, [quote.id]: true }));
    try {
      const res = await axios.post(
        "/api/retailer/cart/items/",
        { quote_id: quote.id, selected_quantity: qtyVal },
        { withCredentials: true }
      );
      alert(`🎉 ${res.data?.message || "Reserved quote stock into your cart!"}`);
      fetchCartCount();
      fetchFpoQuotes(currentFilters);
      refresh(["retailer", "inventory"]);
      if (activeProductModal?.id === quote.id) {
        setActiveProductModal(null);
      }
    } catch (err) {
      console.error("Error adding quote to cart:", err.response?.data || err);
      const msg = err.response?.data?.error || "Failed to add item to cart.";
      alert(`❌ ${msg}`);
    } finally {
      setAddingToCartMap((prev) => ({ ...prev, [quote.id]: false }));
    }
  };

  // Fetch open FPO quotes
  const fetchFpoQuotes = useCallback(async (params = {}) => {
    setQuotesLoading(true);
    try {
      const cleanParams = {};
      Object.keys(params).forEach((k) => {
        if (params[k]) cleanParams[k] = params[k];
      });

      const res = await axios.get("/api/retailer/quotes/fpo/open/", {
        params: cleanParams,
        withCredentials: true,
      });
      setFpoQuotes(res.data || []);
    } catch (err) {
      console.error("Error fetching FPO quotes:", err);
    } finally {
      setQuotesLoading(false);
    }
  }, []);

  // Fetch my submitted bids
  const fetchMyBids = useCallback(async () => {
    setBidsLoading(true);
    try {
      const res = await axios.get("/api/retailer/bids/my/", {
        withCredentials: true,
      });
      setMyBids(res.data || []);
    } catch (err) {
      console.error("Error fetching my bids:", err);
    } finally {
      setBidsLoading(false);
    }
  }, []);

  const fetchEscrowsAndInventoryCounts = useCallback(async () => {
    try {
      const [escrowRes, invRes] = await Promise.allSettled([
        axios.get("/api/escrow/retailer/my/", { withCredentials: true }),
        axios.get("/api/retailer/inventory/my/", { withCredentials: true }),
      ]);
      if (escrowRes.status === "fulfilled") {
        setEscrowsCount(escrowRes.value.data?.escrows?.length || 0);
      }
      if (invRes.status === "fulfilled") {
        setInventoryCount(invRes.value.data?.items?.length || 0);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchFpoQuotes();
    fetchMyBids();
    fetchDid();
    fetchCartCount();
    fetchEscrowsAndInventoryCounts();
  }, [fetchFpoQuotes, fetchMyBids, fetchDid, fetchCartCount, fetchEscrowsAndInventoryCounts]);

  useRefreshSubscription(
    ["retailer", "fpo", "quotes", "bids", "deals", "inventory", "escrow", "transactions"],
    () => {
      fetchFpoQuotes(currentFilters);
      fetchMyBids();
      fetchDid();
      fetchCartCount();
      fetchEscrowsAndInventoryCounts();
    }
  );

  const handleFilterChange = useCallback((newFilters) => {
    setCurrentFilters(newFilters);
    fetchFpoQuotes(newFilters);
  }, [fetchFpoQuotes]);

  const openBidModal = (quote) => {
    setActiveBidQuote(quote);
    setBidAmountInput(quote.price_per_unit || "");
    setBidDaysInput("3");
    setBidStatusMsg(null);
  };

  const submitBid = async (e) => {
    if (e) e.preventDefault();
    if (!activeBidQuote) return;

    const amount = bidAmountInput;
    const days = bidDaysInput;

    if (!amount || Number(amount) <= 0) {
      alert("⚠️ Please enter a valid positive bid amount in ETH.");
      return;
    }
    if (!days || Number(days) <= 0) {
      alert("⚠️ Please enter a valid delivery time in days (minimum 1 day).");
      return;
    }

    setBidSubmitting(true);
    setBidStatusMsg(null);

    try {
      await axios.post(
        `/api/retailer/quotes/fpo/${activeBidQuote.id}/bids/`,
        {
          bid_amount: amount,
          delivery_time_days: days,
          quote: activeBidQuote.id,
          retailer: retailerId,
        },
        { withCredentials: true }
      );
      setBidStatusMsg({ type: "success", text: "✅ Bid placed successfully! FPO will review your offer." });
      fetchMyBids();
      fetchFpoQuotes(currentFilters);
      refresh(["retailer", "bids", "quotes", "fpo"]);
      setTimeout(() => {
        setActiveBidQuote(null);
        if (activeProductModal?.id === activeBidQuote.id) {
          setActiveProductModal(null);
        }
      }, 1200);
    } catch (err) {
      console.error("Error placing bid:", err.response?.data || err);
      const msg = err.response?.data?.error || err.response?.data?.detail || "Failed to place bid. Please try again.";
      setBidStatusMsg({ type: "error", text: `❌ ${msg}` });
    } finally {
      setBidSubmitting(false);
    }
  };

  const acceptedBidsCount = myBids.filter((b) => b.status === "accepted").length;

  const navItems = [
    { id: "dashboard", label: "Dashboard", icon: "🏠", count: null },
    { id: "market", label: "Market", icon: "🛒", count: fpoQuotes.length > 0 ? fpoQuotes.length : null },
    { id: "deals", label: "Deals", icon: "🤝", count: myBids.length > 0 ? myBids.length : null },
    { id: "cart", label: "Cart", icon: "🛍️", count: cartCount > 0 ? cartCount : null },
    { id: "inventory", label: "Inventory", icon: "📦", count: inventoryCount > 0 ? inventoryCount : null },
    { id: "transactions", label: "Transactions", icon: "💰", count: escrowsCount > 0 ? escrowsCount : null },
    { id: "identity", label: "Identity", icon: "🪪", count: null },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col text-slate-900 font-sans">
      {/* ── Top Navbar ──────────────────────────────────────────────── */}
      <DashboardNavbar
        role="retailer"
        userName={didInfo?.name || "Retail Buyer"}
        didInfo={didInfo}
        onLogout={logout}
        onToggleMobileMenu={() => setIsMobileMenuOpen((prev) => !prev)}
      />

      {/* ── Main Layout (Sidebar + Content) ─────────────────────────── */}
      <div className="flex-1 flex max-w-7xl mx-auto w-full">
        {/* ── Desktop Left Sidebar (~240px) ───────────────────────────── */}
        <aside className="w-60 xl:w-64 border-r border-slate-200/80 bg-white min-h-[calc(100vh-65px)] flex flex-col justify-between shrink-0 hidden md:flex">
          <div className="p-4 space-y-4">
            <div className="px-3 py-2 bg-purple-50/70 border border-purple-200/70 rounded-xl">
              <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700 block">
                Commercial Buyer Portal
              </span>
              <p className="text-xs font-extrabold text-slate-900 truncate mt-0.5">
                {didInfo?.name || "Retail Organization"}
              </p>
            </div>

            {/* Navigation Menu */}
            <nav className="space-y-1">
              {navItems.map((item) => {
                const isActive = activeNav === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveNav(item.id)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      isActive
                        ? "bg-purple-600 text-white shadow-xs"
                        : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="text-base">{item.icon}</span>
                      <span>{item.label}</span>
                    </div>
                    {item.count !== null && item.count > 0 && (
                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${
                          isActive
                            ? "bg-purple-700/80 text-white"
                            : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {item.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Sidebar Footer */}
          <div className="p-4 border-t border-slate-100 space-y-3">
            <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 space-y-1 text-xs">
              <span className="text-[10px] text-slate-400 font-bold uppercase block">Verified DID</span>
              <div className="truncate">
                {didInfo?.did ? (
                  <AddressCopy address={didInfo.did} />
                ) : (
                  <span className="text-slate-400 text-[11px]">Connecting DID…</span>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={logout}
              className="w-full py-2 text-xs font-bold text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5"
            >
              <span>🚪</span>
              <span>Sign Out</span>
            </button>
          </div>
        </aside>

        {/* ── Mobile Slide-over Drawer ────────────────────────────────── */}
        {isMobileMenuOpen && (
          <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex md:hidden animate-fade-in">
            <div className="w-72 bg-white h-full shadow-2xl flex flex-col justify-between p-4 space-y-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">🏪</span>
                    <div>
                      <h3 className="text-sm font-extrabold text-slate-900">Retailer Portal</h3>
                      <p className="text-[11px] text-purple-700 font-semibold">Wholesale Marketplace</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
                  >
                    ✕
                  </button>
                </div>

                <nav className="space-y-1">
                  {navItems.map((item) => {
                    const isActive = activeNav === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          setActiveNav(item.id);
                          setIsMobileMenuOpen(false);
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
                          isActive
                            ? "bg-purple-600 text-white"
                            : "text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <span>{item.icon}</span>
                          <span>{item.label}</span>
                        </div>
                        {item.count !== null && item.count > 0 && (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-purple-100 text-purple-900">
                            {item.count}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </nav>
              </div>

              <div className="pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={logout}
                  className="w-full py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-xl"
                >
                  Sign Out
                </button>
              </div>
            </div>
            <div className="flex-1" onClick={() => setIsMobileMenuOpen(false)} />
          </div>
        )}

        {/* ── Main Content Body ───────────────────────────────────────── */}
        <main className="flex-1 p-3.5 sm:p-6 lg:p-7 min-w-0 space-y-5">
          {/* Mobile Quick Navigation Pill Bar */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:hidden">
            {navItems.map((item) => {
              const isActive = activeNav === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveNav(item.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all ${
                    isActive
                      ? "bg-purple-600 text-white shadow-2xs"
                      : "bg-white text-slate-600 border border-slate-200/80"
                  }`}
                >
                  <span>{item.icon}</span> {item.label}
                  {item.count !== null && item.count > 0 && ` (${item.count})`}
                </button>
              );
            })}
          </div>

          {/* ════════════════════════════════════════════════════════════ */}
          {/* VIEW 1: DASHBOARD (Wholesale Marketplace Homepage)           */}
          {/* ════════════════════════════════════════════════════════════ */}
          {activeNav === "dashboard" && (
            <div className="space-y-5 animate-fade-in">
              {/* Homepage Hero Surface */}
              <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-6 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1 min-w-0">
                  <h1 className="text-lg sm:text-2xl font-bold text-slate-900 tracking-tight truncate">
                    Wholesale Marketplace
                  </h1>
                  <p className="text-xs text-slate-500 max-w-xl">
                    Find verified agricultural products from FPOs.
                  </p>
                </div>

                {/* Quick Action Buttons */}
                <div className="flex items-center gap-2 shrink-0 flex-wrap sm:flex-nowrap">
                  <button
                    type="button"
                    onClick={() => setActiveNav("market")}
                    className="px-4 py-2.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>🛒</span>
                    <span>Browse Market</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveNav("inventory")}
                    className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-xl transition-all cursor-pointer flex items-center gap-1"
                  >
                    <span>📦</span>
                    <span>View Inventory</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveNav("cart")}
                    className="px-3.5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>🛍️</span>
                    <span>Cart ({cartCount})</span>
                  </button>
                </div>
              </div>

              {/* 4 Compact Operational Metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-white border border-slate-200/80 rounded-2xl p-3.5 shadow-2xs hover:border-purple-200 transition-all min-w-0">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 block truncate">
                    🛒 Market Offers
                  </span>
                  <p className="text-xl sm:text-2xl font-bold text-slate-900 mt-1 font-mono tracking-tight truncate">
                    {fpoQuotes.length}
                  </p>
                  <p className="text-[11px] text-purple-700 font-medium mt-0.5 truncate">
                    Available Lots
                  </p>
                </div>

                <div className="bg-white border border-slate-200/80 rounded-2xl p-3.5 shadow-2xs hover:border-blue-200 transition-all min-w-0">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 block truncate">
                    🤝 Active Deals
                  </span>
                  <p className="text-xl sm:text-2xl font-bold text-slate-900 mt-1 font-mono tracking-tight truncate">
                    {myBids.length}
                  </p>
                  <p className="text-[11px] text-blue-700 font-medium mt-0.5 truncate">
                    {acceptedBidsCount} Accepted
                  </p>
                </div>

                <div className="bg-white border border-slate-200/80 rounded-2xl p-3.5 shadow-2xs hover:border-emerald-200 transition-all min-w-0">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 block truncate">
                    📦 My Inventory
                  </span>
                  <p className="text-xl sm:text-2xl font-bold text-slate-900 mt-1 font-mono tracking-tight truncate">
                    {inventoryCount}
                  </p>
                  <p className="text-[11px] text-emerald-700 font-medium mt-0.5 truncate">
                    Purchased Lots
                  </p>
                </div>

                <div className="bg-white border border-slate-200/80 rounded-2xl p-3.5 shadow-2xs hover:border-amber-200 transition-all min-w-0">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 block truncate">
                    💰 Transactions
                  </span>
                  <p className="text-xl sm:text-2xl font-bold text-slate-900 mt-1 font-mono tracking-tight truncate">
                    {escrowsCount}
                  </p>
                  <p className="text-[11px] text-amber-700 font-medium mt-0.5 truncate">
                    Secured Escrows
                  </p>
                </div>
              </div>

              {/* Supply Chain Flow Pipeline Overview */}
              <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 shadow-2xs space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900">
                      ⛓️ End-to-End Agri Supply Chain Pipeline
                    </h3>
                    <p className="text-xs text-slate-500">
                      Verified path from farm harvest to retail warehouse
                    </p>
                  </div>
                  <span className="text-[10px] uppercase font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200">
                    Retail Procurement Tier
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-start gap-3">
                    <span className="text-2xl">🌾</span>
                    <div>
                      <span className="font-extrabold text-slate-900 block">1. Farm Producer</span>
                      <span className="text-slate-500 text-[11px]">Harvest registration, AI quality grading, and IPFS crop passport.</span>
                    </div>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-start gap-3">
                    <span className="text-2xl">🏢</span>
                    <div>
                      <span className="font-extrabold text-slate-900 block">2. FPO Aggregator</span>
                      <span className="text-slate-500 text-[11px]">Bulk aggregation, quality sorting, and wholesale market quotes.</span>
                    </div>
                  </div>

                  <div className="p-3 bg-purple-50/70 rounded-xl border border-purple-200 flex items-start gap-3 ring-1 ring-purple-300">
                    <span className="text-2xl">🏪</span>
                    <div>
                      <span className="font-extrabold text-purple-950 block">3. Retailer Buyer (You)</span>
                      <span className="text-purple-700 text-[11px]">Bulk reserve, smart contract escrow funding, and delivery receipt.</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Featured Wholesale Products Preview */}
              <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-6 shadow-2xs space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 flex-wrap gap-2">
                  <div>
                    <h3 className="text-sm sm:text-base font-extrabold text-slate-900">
                      🛒 Featured Wholesale Lots
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Traceable commercial bulk lots aggregated by verified FPO partners
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setActiveNav("market")}
                    className="text-xs font-bold text-purple-700 hover:text-purple-800"
                  >
                    View All Lots ({fpoQuotes.length}) →
                  </button>
                </div>

                {quotesLoading ? (
                  <div className="py-12 text-center text-xs text-slate-400 animate-pulse">
                    Loading commercial catalog…
                  </div>
                ) : fpoQuotes.length === 0 ? (
                  <div className="py-12 text-center bg-slate-50/70 rounded-2xl border border-slate-200/80 space-y-2">
                    <span className="text-4xl block">🏪</span>
                    <p className="text-sm font-bold text-slate-800">No Wholesale Products Available</p>
                    <p className="text-xs text-slate-400 max-w-sm mx-auto">
                      FPOs have not published any open wholesale lots at this time. Please check back shortly.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                    {fpoQuotes.slice(0, 6).map((quote) => {
                      const avail = quote.available_quantity ?? quote.quantity;
                      const cp = quote.crop_passport_details;
                      const aiGrade = cp?.latest_ai_verification?.quality_grade || cp?.quality_grade;

                      return (
                        <div
                          key={quote.id}
                          className="bg-white border border-slate-200/90 rounded-2xl p-4 hover:border-purple-300 hover:shadow-xs transition-all flex flex-col justify-between gap-3 min-w-0"
                        >
                          <div className="space-y-2 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <h4 className="text-sm font-extrabold text-slate-900 truncate">
                                  {quote.product_name}
                                </h4>
                                <p className="text-[11px] text-slate-500 truncate">
                                  Supplier: <strong className="text-slate-800 font-semibold">{quote.fpo_name || `FPO #${quote.fpo}`}</strong>
                                </p>
                              </div>
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200 shrink-0">
                                {quote.category}
                              </span>
                            </div>

                            <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between text-xs font-mono">
                              <div>
                                <span className="text-[10px] text-slate-400 font-bold uppercase block font-sans">Available Volume</span>
                                <span className="font-extrabold text-slate-900 font-mono text-xs">
                                  {avail} {quote.unit}
                                </span>
                              </div>
                              <div className="text-right">
                                <span className="text-[10px] text-slate-400 font-bold uppercase block font-sans">Unit Rate</span>
                                <span className="font-bold text-purple-700 font-mono text-xs">
                                  {formatCommercialPrice(quote.price_per_unit, quote.unit)}
                                </span>
                              </div>
                            </div>

                            {aiGrade && (
                              <div className="flex items-center gap-1.5 text-[10px]">
                                <span className="font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200">
                                  Grade {aiGrade}
                                </span>
                                {quote.deadline && (
                                  <span className="text-slate-400 truncate">Due: {quote.deadline}</span>
                                )}
                              </div>
                            )}
                          </div>

                          {/* 3 Action Buttons: [View Details], [Negotiate], [Buy] */}
                          <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setShowBlockchainDetails(false);
                                setActiveProductModal(quote);
                              }}
                              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl transition-all cursor-pointer shrink-0"
                            >
                              View
                            </button>

                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => openBidModal(quote)}
                                className="px-2.5 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-800 text-xs font-bold rounded-xl border border-purple-200 transition-all cursor-pointer"
                              >
                                Negotiate
                              </button>

                              <button
                                type="button"
                                onClick={() => handleAddToCart(quote)}
                                disabled={addingToCartMap[quote.id]}
                                className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer disabled:opacity-50"
                              >
                                {addingToCartMap[quote.id] ? "…" : "Buy"}
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════ */}
          {/* VIEW 2: MARKET (Wholesale Commercial Catalog)                */}
          {/* ════════════════════════════════════════════════════════════ */}
          {activeNav === "market" && (
            <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-6 shadow-2xs space-y-4 animate-fade-in">
              <div className="pb-3 border-b border-slate-100 flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h2 className="text-base font-extrabold text-slate-900">
                    🛒 B2B Wholesale Commercial Catalog
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Browse bulk agricultural lots aggregated by verified Farmer Producer Organizations (FPOs)
                  </p>
                </div>

                {fpoQuotes.length > 0 && (
                  <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
                    {fpoQuotes.length} Lots Available
                  </span>
                )}
              </div>

              <MarketplaceFilterBar
                onFilterChange={handleFilterChange}
                showHarvestDate={false}
                placeholder="Search wholesale products by name, category, or FPO partner…"
              />

              {quotesLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                  {[1, 2, 3, 4, 5, 6].map((i) => (
                    <div key={i} className="bg-slate-50 border border-slate-200/60 rounded-2xl p-4 animate-pulse space-y-2">
                      <div className="h-4 bg-slate-200 rounded w-1/2"></div>
                      <div className="h-3 bg-slate-200 rounded w-2/3"></div>
                    </div>
                  ))}
                </div>
              ) : fpoQuotes.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                  {fpoQuotes.map((quote) => {
                    const avail = quote.available_quantity ?? quote.quantity;
                    const cp = quote.crop_passport_details;
                    const aiGrade = cp?.latest_ai_verification?.quality_grade || cp?.quality_grade;

                    return (
                      <div
                        key={quote.id}
                        className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-4.5 hover:border-purple-300 hover:shadow-xs transition-all flex flex-col justify-between gap-3 min-w-0"
                      >
                        <div className="space-y-2.5 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <h4 className="text-sm sm:text-base font-extrabold text-slate-900 truncate">
                                {quote.product_name}
                              </h4>
                              <p className="text-xs text-slate-500 truncate">
                                Supplier: <strong className="text-slate-800 font-semibold">{quote.fpo_name || `FPO #${quote.fpo}`}</strong>
                              </p>
                            </div>
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200 shrink-0">
                              {quote.category}
                            </span>
                          </div>

                          {/* Image Preview if available */}
                          {quote.primary_image_url ? (
                            <img
                              src={quote.primary_image_url}
                              alt={quote.product_name}
                              className="w-full h-32 object-cover rounded-xl border border-slate-200 shadow-2xs"
                            />
                          ) : (
                            <div className="w-full h-24 bg-purple-50/40 rounded-xl border border-purple-100 flex items-center justify-center text-slate-400 text-xs">
                              🌾 Verified Agri Lot
                            </div>
                          )}

                          <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between text-xs font-mono">
                            <div>
                              <span className="text-[10px] text-slate-400 font-bold uppercase block font-sans">Available Volume</span>
                              <span className="font-extrabold text-slate-900 font-mono text-xs">
                                {avail} {quote.unit}
                              </span>
                            </div>
                            <div className="text-right">
                              <span className="text-[10px] text-slate-400 font-bold uppercase block font-sans">Unit Price</span>
                              <span className="font-bold text-purple-700 font-mono text-xs">
                                {formatCommercialPrice(quote.price_per_unit, quote.unit)}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center justify-between text-[10px]">
                            {aiGrade ? (
                              <span className="font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                                Grade {aiGrade}
                              </span>
                            ) : (
                              <span className="text-slate-400">Verified Crop</span>
                            )}
                            {quote.deadline && (
                              <span className="font-semibold text-slate-500">
                                Due: {quote.deadline}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* 3 Clear Actions: [View Details], [Negotiate], [Buy] */}
                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setShowBlockchainDetails(false);
                              setActiveProductModal(quote);
                            }}
                            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl transition-all cursor-pointer shrink-0"
                          >
                            View Details
                          </button>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => openBidModal(quote)}
                              className="px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-800 text-xs font-bold rounded-xl border border-purple-200 transition-all cursor-pointer"
                            >
                              Negotiate
                            </button>

                            <button
                              type="button"
                              onClick={() => handleAddToCart(quote)}
                              disabled={addingToCartMap[quote.id]}
                              className="px-3.5 py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-xl transition-all shadow-xs flex items-center gap-1 cursor-pointer disabled:opacity-50"
                            >
                              <span>🛒</span>
                              <span>{addingToCartMap[quote.id] ? "…" : "Buy"}</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-12 text-center bg-slate-50/70 rounded-2xl border border-slate-100 space-y-2">
                  <span className="text-4xl block">🔍</span>
                  <p className="text-sm font-bold text-slate-800">No Wholesale Products Found</p>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto">
                    Try adjusting or clearing your search filters to view more listings.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════ */}
          {/* VIEW 3: DEALS (Negotiations, Orders & Completed Deals)       */}
          {/* ════════════════════════════════════════════════════════════ */}
          {activeNav === "deals" && (
            <div className="space-y-5 animate-fade-in">
              {/* Section 1: Active Negotiations */}
              <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-6 shadow-2xs space-y-4">
                <div className="pb-3 border-b border-slate-100 flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <h2 className="text-base font-bold text-slate-900">
                      🤝 Active Negotiations ({myBids.length})
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Ongoing negotiations and procurement bids placed with FPO suppliers.
                    </p>
                  </div>
                </div>

                {bidsLoading ? (
                  <div className="space-y-3">
                    {[1, 2].map((i) => (
                      <div key={i} className="bg-slate-50 border border-slate-200/60 rounded-2xl p-4 animate-pulse space-y-2">
                        <div className="h-4 bg-slate-200 rounded w-1/3"></div>
                        <div className="h-3 bg-slate-200 rounded w-1/2"></div>
                      </div>
                    ))}
                  </div>
                ) : myBids.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                    {myBids.map((bid) => {
                      const breakdown = formatSettlementBreakdown(bid.bid_amount, bid.quote.quantity);
                      return (
                        <div
                          key={bid.id}
                          className="border border-slate-200/80 rounded-2xl p-4 bg-white hover:border-purple-300 transition-all space-y-3 shadow-2xs"
                        >
                          <div className="flex justify-between items-start gap-2">
                            <div className="min-w-0">
                              <p className="text-sm font-bold text-slate-900 truncate">
                                {bid.quote.product_name}
                              </p>
                              <span className="text-[11px] text-slate-500 font-medium truncate block mt-0.5">
                                FPO: <span className="font-semibold text-slate-800">{bid.quote.fpo_name || `FPO #${bid.quote.fpo}`}</span>
                              </span>
                            </div>
                            <StatusBadge status={bid.status} />
                          </div>

                          <div className="grid grid-cols-3 gap-2 text-xs bg-slate-50/70 p-2.5 rounded-xl border border-slate-100 font-mono">
                            <div>
                              <span className="text-[10px] text-slate-500 font-semibold uppercase block font-sans">Quantity</span>
                              <span className="font-bold text-slate-800 mt-0.5 block truncate">{bid.quote.quantity} {bid.quote.unit}</span>
                            </div>
                            <div>
                              <span className="text-[10px] text-slate-500 font-semibold uppercase block font-sans">Unit Price</span>
                              <span className="font-semibold text-blue-700 mt-0.5 block truncate">
                                {formatCommercialPrice(bid.bid_amount, bid.quote.unit)}
                              </span>
                            </div>
                            <div>
                              <span className="text-[10px] text-slate-500 font-semibold uppercase block font-sans">Total</span>
                              <span className="font-bold text-purple-700 mt-0.5 block truncate">{breakdown.totalInr}</span>
                              <span className="text-[9px] text-slate-400 block truncate font-sans font-normal">≈ {breakdown.totalEth}</span>
                            </div>
                          </div>

                          <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                            <span className="text-[11px] text-slate-400 font-medium">
                              Delivery in {bid.delivery_time_days} days
                            </span>
                            <button
                              type="button"
                              onClick={() => setNegotiatingBid({ bid: bid, contentType: "retailer.retailerbid" })}
                              className="px-3.5 py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold rounded-xl transition-all cursor-pointer flex items-center gap-1 shadow-2xs shrink-0"
                            >
                              <span>💬</span>
                              <span>View Deal</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="py-10 text-center bg-slate-50/70 rounded-2xl border border-slate-100 space-y-2">
                    <span className="text-4xl block mb-1">🤝</span>
                    <p className="text-sm font-bold text-slate-800">No Bids Submitted Yet</p>
                    <p className="text-xs text-slate-400 max-w-sm mx-auto">
                      Browse open FPO quotes in the Market tab and submit your procurement offers.
                    </p>
                  </div>
                )}
              </div>

              {/* Sections 2 & 3: Confirmed Orders & Completed Deals */}
              <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-6 shadow-2xs">
                <RetailerOrdersPanel />
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════ */}
          {/* VIEW 4: CART (Temporary Checkout State)                      */}
          {/* ════════════════════════════════════════════════════════════ */}
          {activeNav === "cart" && (
            <div className="space-y-4 animate-fade-in">
              <RetailerCartPanel
                onCartUpdated={() => {
                  fetchCartCount();
                  fetchFpoQuotes(currentFilters);
                }}
                onOrderCreated={() => {
                  fetchCartCount();
                  setActiveNav("deals");
                }}
              />
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════ */}
          {/* VIEW 5: INVENTORY (Permanent Purchased Stock)                */}
          {/* ════════════════════════════════════════════════════════════ */}
          {activeNav === "inventory" && (
            <div className="space-y-4 animate-fade-in">
              <RetailerInventoryPanel />
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════ */}
          {/* VIEW 6: TRANSACTIONS (Escrow Deals)                          */}
          {/* ════════════════════════════════════════════════════════════ */}
          {activeNav === "transactions" && (
            <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-6 shadow-2xs space-y-4 animate-fade-in">
              <div className="pb-3 border-b border-slate-100">
                <h2 className="text-base font-extrabold text-slate-900">
                  🔐 Smart Contract Escrow Payments (FPO ↔ Retailer)
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Lock escrow funds in Sepolia testnet smart contracts and release payment once bulk delivery is inspected
                </p>
              </div>

              <RetailerEscrowPanel
                onPaymentReleased={() => setActiveNav("inventory")}
                onEscrowUpdated={() => {
                  fetchMyBids();
                  fetchFpoQuotes(currentFilters);
                }}
              />
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════ */}
          {/* VIEW 7: IDENTITY & VERIFICATION                              */}
          {/* ════════════════════════════════════════════════════════════ */}
          {activeNav === "identity" && (
            <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-6 shadow-2xs space-y-5 animate-fade-in">
              <div className="pb-3 border-b border-slate-100">
                <h2 className="text-base font-extrabold text-slate-900">
                  🪪 Retailer Commercial Identity & Trust Profile
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Verified W3C Decentralized Identifier (DID) and Web3 commercial reputation index
                </p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <DidIdentityCard didInfo={didInfo} accentColor="purple" />
                <TrustReputationCard accentColor="purple" />
              </div>
            </div>
          )}
        </main>
      </div>

      {/* ── Retailer Product Details Modal with Supply Chain Provenance Flow ── */}
      {activeProductModal && (
        <BaseModal
          isOpen={Boolean(activeProductModal)}
          onClose={() => setActiveProductModal(null)}
          title={activeProductModal.product_name}
          subtitle={`Wholesale Lot #${activeProductModal.id} · Supplied by ${activeProductModal.fpo_name || `FPO #${activeProductModal.fpo}`}`}
          icon="🛒"
          badge={<StatusBadge status={activeProductModal.status || "open"} />}
          maxWidth="max-w-2xl"
          footer={
            <div className="flex items-center justify-between w-full">
              <button
                type="button"
                onClick={() => setActiveProductModal(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all cursor-pointer"
              >
                Close
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const q = activeProductModal;
                    setActiveProductModal(null);
                    openBidModal(q);
                  }}
                  className="px-4 py-2 bg-purple-50 hover:bg-purple-100 text-purple-800 text-xs font-bold rounded-xl border border-purple-200 transition-all cursor-pointer"
                >
                  Negotiate / Bid
                </button>

                <button
                  type="button"
                  onClick={() => handleAddToCart(activeProductModal)}
                  disabled={addingToCartMap[activeProductModal.id]}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-xl transition-all shadow-xs flex items-center gap-1 cursor-pointer disabled:opacity-50"
                >
                  <span>🛒</span>
                  <span>{addingToCartMap[activeProductModal.id] ? "Reserving…" : "Buy Now"}</span>
                </button>
              </div>
            </div>
          }
        >
          <div className="space-y-4 text-xs">
            {/* Image Preview */}
            {activeProductModal.primary_image_url && (
              <img
                src={activeProductModal.primary_image_url}
                alt={activeProductModal.product_name}
                className="w-full h-44 object-cover rounded-2xl border border-slate-200 shadow-2xs"
              />
            )}

            {/* Specifications Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 min-w-0">
                <span className="text-[10px] text-slate-400 font-bold uppercase block truncate">Available Quantity</span>
                <span className="font-extrabold font-mono text-slate-900 block mt-0.5 truncate">
                  {activeProductModal.available_quantity ?? activeProductModal.quantity} {activeProductModal.unit}
                </span>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 min-w-0">
                <span className="text-[10px] text-slate-400 font-bold uppercase block truncate">Wholesale Rate</span>
                <span className="font-extrabold font-mono text-purple-700 block mt-0.5 truncate">
                  {formatCommercialPrice(activeProductModal.price_per_unit, activeProductModal.unit)}
                </span>
                <span className="text-[10px] text-slate-400 block truncate font-sans">
                  Settlement: {formatSettlementBreakdown(activeProductModal.price_per_unit, 1).totalEth} / {activeProductModal.unit}
                </span>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 min-w-0">
                <span className="text-[10px] text-slate-400 font-bold uppercase block truncate">Supplier FPO</span>
                <span className="font-semibold text-slate-800 block mt-0.5 truncate">
                  {activeProductModal.fpo_name || `FPO #${activeProductModal.fpo}`}
                </span>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 min-w-0">
                <span className="text-[10px] text-slate-400 font-bold uppercase block truncate">Bidding Deadline</span>
                <span className="font-medium text-slate-700 block mt-0.5 truncate">
                  {activeProductModal.deadline || "Open"}
                </span>
              </div>
            </div>

            {/* Visual Provenance Flow: Farmer → Crop Passport → FPO → Retailer */}
            <div className="bg-purple-50/50 border border-purple-200/80 rounded-2xl p-4 space-y-3">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-purple-900 block">
                ⛓️ Supply Chain Provenance Lineage
              </span>

              <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-xs">
                <div className="bg-white p-2.5 rounded-xl border border-purple-100 text-center flex-1 w-full">
                  <span className="text-base block mb-0.5">🌾</span>
                  <span className="font-bold text-slate-900 block text-[11px]">Farmer Harvest</span>
                  <span className="text-[10px] text-slate-500">Verified Producer</span>
                </div>
                <span className="text-purple-400 font-bold hidden sm:inline">➔</span>
                <div className="bg-white p-2.5 rounded-xl border border-purple-100 text-center flex-1 w-full">
                  <span className="text-base block mb-0.5">📜</span>
                  <span className="font-bold text-slate-900 block text-[11px]">Crop Passport</span>
                  <span className="text-[10px] text-slate-500">IPFS & AI Grade</span>
                </div>
                <span className="text-purple-400 font-bold hidden sm:inline">➔</span>
                <div className="bg-white p-2.5 rounded-xl border border-purple-100 text-center flex-1 w-full">
                  <span className="text-base block mb-0.5">🏢</span>
                  <span className="font-bold text-slate-900 block text-[11px]">FPO Aggregator</span>
                  <span className="text-[10px] text-slate-500">Bulk Lot Assembly</span>
                </div>
                <span className="text-purple-400 font-bold hidden sm:inline">➔</span>
                <div className="bg-white p-2.5 rounded-xl border border-purple-200 text-center flex-1 w-full ring-1 ring-purple-300">
                  <span className="text-base block mb-0.5">🏪</span>
                  <span className="font-bold text-purple-900 block text-[11px]">Retailer Buy</span>
                  <span className="text-[10px] text-purple-600 font-semibold">Your Procurement</span>
                </div>
              </div>

              {/* Provenance Allocations Breakdown */}
              <ProvenanceCard
                allocations={activeProductModal.allocations}
                provenanceSummary={activeProductModal.provenance_summary}
                fpoName={activeProductModal.fpo_name}
              />
            </div>

            {/* Collapsible Blockchain & Contract Details */}
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <button
                type="button"
                onClick={() => setShowBlockchainDetails((prev) => !prev)}
                className="w-full px-3.5 py-2.5 bg-slate-50 hover:bg-slate-100 flex items-center justify-between text-xs font-bold text-slate-700 transition-all cursor-pointer"
              >
                <div className="flex items-center gap-1.5">
                  <span>🔐</span>
                  <span>Blockchain & Smart Contract Verification</span>
                </div>
                <span className="text-slate-400">{showBlockchainDetails ? "▲ Hide" : "▼ Show"}</span>
              </button>

              {showBlockchainDetails && (
                <div className="p-3.5 space-y-2 bg-white text-xs border-t border-slate-200">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">Settlement Network:</span>
                    <span className="font-mono font-bold text-slate-800">Ethereum Sepolia Testnet</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">Smart Contract:</span>
                    <span className="font-mono text-purple-700 font-semibold">AgriEscrowV2</span>
                  </div>
                  {activeProductModal.crop_passport_details?.farmer_did && (
                    <div className="flex justify-between items-center pt-1 border-t border-slate-100">
                      <span className="text-slate-500">Farmer DID:</span>
                      <AddressCopy address={activeProductModal.crop_passport_details.farmer_did} />
                    </div>
                  )}
                  {activeProductModal.crop_passport_details?.ipfs_hash && (
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">IPFS Metadata Hash:</span>
                      <AddressCopy address={activeProductModal.crop_passport_details.ipfs_hash} />
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Quantity Selector for Direct Add to Cart */}
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-0.5">
                  Select Purchase Quantity ({activeProductModal.unit})
                </label>
                <span className="text-[10px] text-slate-500">
                  Maximum available: {activeProductModal.available_quantity ?? activeProductModal.quantity} {activeProductModal.unit}
                </span>
              </div>

              <input
                type="number"
                step="any"
                min="0.000001"
                max={activeProductModal.available_quantity ?? activeProductModal.quantity}
                value={cartQuantities[activeProductModal.id] ?? (activeProductModal.available_quantity ?? activeProductModal.quantity)}
                onChange={(e) => handleCartQuantityChange(activeProductModal.id, e.target.value)}
                className="w-full sm:w-32 px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 focus:border-purple-500 outline-none"
              />
            </div>
          </div>
        </BaseModal>
      )}

      {/* ── Negotiate / Bidding Modal ───────────────────────────────── */}
      {activeBidQuote && (
        <BaseModal
          isOpen={Boolean(activeBidQuote)}
          onClose={() => setActiveBidQuote(null)}
          title={`Place Procurement Bid: ${activeBidQuote.product_name}`}
          subtitle={`Wholesale Lot #${activeBidQuote.id} · ${activeBidQuote.quantity} ${activeBidQuote.unit}`}
          icon="💰"
          maxWidth="max-w-md"
        >
          <form onSubmit={submitBid} className="space-y-4 text-xs">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500">Product:</span>
                <span className="font-bold text-slate-900">{activeBidQuote.product_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Available:</span>
                <span className="font-bold text-slate-900">{activeBidQuote.quantity} {activeBidQuote.unit}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">FPO Asking Rate:</span>
                <span className="font-mono text-purple-700 font-bold">{activeBidQuote.price_per_unit} ETH / {activeBidQuote.unit}</span>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                Your Offer (₹ INR / {activeBidQuote.unit}) *
              </label>
              <input
                type="number"
                step="any"
                min="0.000001"
                required
                placeholder="e.g. 150"
                value={bidAmountInput}
                onChange={(e) => setBidAmountInput(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 focus:border-purple-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                Required Delivery Window (Days) *
              </label>
              <input
                type="number"
                min="1"
                required
                placeholder="3"
                value={bidDaysInput}
                onChange={(e) => setBidDaysInput(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:border-purple-500 outline-none"
              />
            </div>

            {bidAmountInput && Number(bidAmountInput) > 0 && (
              <div className="p-3 bg-purple-50 rounded-xl border border-purple-200 flex items-center justify-between">
                <span className="text-purple-900 font-semibold text-xs">Estimated Total:</span>
                <div className="text-right">
                  <span className="font-extrabold text-purple-950 font-mono text-sm block">
                    {formatSettlementBreakdown(bidAmountInput, activeBidQuote.quantity).totalInr}
                  </span>
                  <span className="text-[10px] text-purple-700 font-mono block">
                    Settlement: {formatSettlementBreakdown(bidAmountInput, activeBidQuote.quantity).totalEth}
                  </span>
                </div>
              </div>
            )}

            {bidStatusMsg && (
              <div className={`p-3 rounded-xl text-xs font-semibold ${
                bidStatusMsg.type === "success" ? "bg-emerald-50 border border-emerald-200 text-emerald-800" : "bg-rose-50 border border-rose-200 text-rose-800"
              }`}>
                {bidStatusMsg.text}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setActiveBidQuote(null)}
                className="px-3.5 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 rounded-xl hover:bg-slate-100 transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={bidSubmitting || !bidAmountInput || Number(bidAmountInput) <= 0}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-xl transition-all shadow-xs flex items-center gap-1 cursor-pointer disabled:opacity-50"
              >
                <span>🤝</span>
                <span>{bidSubmitting ? "Submitting…" : "Submit Wholesale Bid"}</span>
              </button>
            </div>
          </form>
        </BaseModal>
      )}

      {/* ── Negotiation Modal ───────────────────────────────────────── */}
      {negotiatingBid && (
        <NegotiationModal
          bid={negotiatingBid.bid}
          contentType={negotiatingBid.contentType}
          currentUserRole="retailer"
          onClose={() => setNegotiatingBid(null)}
          onNegotiationUpdated={() => {
            fetchMyBids();
            fetchFpoQuotes(currentFilters);
            refresh(["retailer", "bids", "quotes", "deals", "fpo"]);
          }}
        />
      )}
    </div>
  );
}
