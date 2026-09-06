import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import Cookies from "js-cookie";
import { useNavigate } from "react-router-dom";
import { useRefresh, useRefreshSubscription } from "../../context/useRefresh";
import TrustReputationCard from "../../components/common/TrustReputationCard";
import DidIdentityCard from "../../components/common/DidIdentityCard";
import DashboardNavbar from "../../components/common/DashboardNavbar";
import StatusBadge from "../../components/common/StatusBadge";
import { calculateTotalEth } from "../../utils/pricing";
import MarketplaceFilterBar from "../../components/common/MarketplaceFilterBar";
import RetailerEscrowPanel from "../../components/retailer/RetailerEscrowPanel";
import RetailerCartPanel from "../../components/retailer/RetailerCartPanel";
import RetailerOrdersPanel from "../../components/retailer/RetailerOrdersPanel";
import RetailerInventoryPanel from "../../components/retailer/RetailerInventoryPanel";
import NegotiationModal from "../../components/common/NegotiationModal";
import ProvenanceCard from "../../components/common/ProvenanceCard";
import BaseModal from "../../components/common/BaseModal";

// activeNav values: "dashboard" | "market" | "deals" | "cart" | "inventory" | "transactions" | "identity"

export default function RetailerDashboard() {
  const { refresh } = useRefresh();
  const navigate = useNavigate();

  const [activeNav, setActiveNav] = useState("dashboard");
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

  // Product Details Modal
  const [activeProductModal, setActiveProductModal] = useState(null);

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

  useEffect(() => {
    fetchFpoQuotes();
    fetchMyBids();
    fetchDid();
    fetchCartCount();
  }, [fetchFpoQuotes, fetchMyBids, fetchDid, fetchCartCount]);

  useRefreshSubscription(
    ["retailer", "fpo", "quotes", "bids", "deals", "inventory", "escrow", "transactions"],
    () => {
      fetchFpoQuotes(currentFilters);
      fetchMyBids();
      fetchDid();
      fetchCartCount();
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

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col text-slate-900 font-sans">
      {/* ── Top Navbar ──────────────────────────────────────────────── */}
      <DashboardNavbar
        role="retailer"
        userName={didInfo?.name || "Retailer"}
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
                  ? "bg-purple-600 text-white shadow-2xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
              }`}
            >
              <span>🏪</span>
              <span>Dashboard</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveNav("market")}
              className={`py-2 px-3 sm:px-4 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeNav === "market"
                  ? "bg-purple-600 text-white shadow-2xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
              }`}
            >
              <span>🛍️</span>
              <span>Market</span>
              {fpoQuotes.length > 0 && (
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                  activeNav === "market" ? "bg-purple-700/80 text-white" : "bg-slate-100 text-slate-600"
                }`}>
                  {fpoQuotes.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveNav("deals")}
              className={`py-2 px-3 sm:px-4 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeNav === "deals"
                  ? "bg-purple-600 text-white shadow-2xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
              }`}
            >
              <span>🤝</span>
              <span>Deals</span>
              {myBids.length > 0 && (
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                  activeNav === "deals" ? "bg-purple-700/80 text-white" : "bg-slate-100 text-slate-600"
                }`}>
                  {myBids.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveNav("cart")}
              className={`py-2 px-3 sm:px-4 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeNav === "cart"
                  ? "bg-purple-600 text-white shadow-2xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
              }`}
            >
              <span>🛒</span>
              <span>Cart</span>
              {cartCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-purple-100 text-purple-900 font-extrabold border border-purple-200">
                  {cartCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveNav("inventory")}
              className={`py-2 px-3 sm:px-4 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeNav === "inventory"
                  ? "bg-purple-600 text-white shadow-2xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
              }`}
            >
              <span>📦</span>
              <span>Inventory</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveNav("transactions")}
              className={`py-2 px-3 sm:px-4 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeNav === "transactions"
                  ? "bg-purple-600 text-white shadow-2xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
              }`}
            >
              <span>🔐</span>
              <span>Transactions</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveNav("identity")}
              className={`py-2 px-3 sm:px-4 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeNav === "identity"
                  ? "bg-purple-600 text-white shadow-2xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
              }`}
            >
              <span>🪪</span>
              <span>Identity</span>
            </button>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════ */}
        {/* VIEW 1: DASHBOARD (Commercial Marketplace Overview)           */}
        {/* ══════════════════════════════════════════════════════════════ */}
        {activeNav === "dashboard" && (
          <div className="space-y-5 animate-fade-in">
            {/* Commercial Header */}
            <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-6 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse shrink-0" />
                  <span className="text-[11px] font-bold text-purple-700 uppercase tracking-wider">
                    Commercial Wholesale Marketplace
                  </span>
                </div>
                <h1 className="text-lg sm:text-2xl font-extrabold text-slate-900 tracking-tight truncate">
                  Welcome back, {didInfo?.name || "Retail Buyer"}
                </h1>
                <p className="text-xs text-slate-500 max-w-xl">
                  Source bulk agricultural inventory from verified FPOs with immutable blockchain provenance.
                </p>
              </div>

              {/* Quick Actions */}
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setActiveNav("market")}
                  className="px-3.5 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <span>🛍️</span>
                  <span>Explore Catalog</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveNav("cart")}
                  className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <span>🛒</span>
                  <span>View Cart ({cartCount})</span>
                </button>
              </div>
            </div>

            {/* 4 Commercial Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-white border border-slate-200/80 rounded-2xl p-3.5 shadow-2xs hover:border-purple-200 transition-all min-w-0">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block truncate">
                  🛍️ Available Lots
                </span>
                <p className="text-xl sm:text-2xl font-extrabold text-slate-900 mt-1 font-mono tracking-tight truncate">
                  {fpoQuotes.length}
                </p>
                <p className="text-[11px] text-purple-600 font-semibold mt-0.5 truncate">
                  Open Wholesale Lots
                </p>
              </div>

              <div className="bg-white border border-slate-200/80 rounded-2xl p-3.5 shadow-2xs hover:border-blue-200 transition-all min-w-0">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block truncate">
                  🛒 Cart Reserved
                </span>
                <p className="text-xl sm:text-2xl font-extrabold text-slate-900 mt-1 font-mono tracking-tight truncate">
                  {cartCount}
                </p>
                <p className="text-[11px] text-blue-600 font-semibold mt-0.5 truncate">
                  Temporary Stock
                </p>
              </div>

              <div className="bg-white border border-slate-200/80 rounded-2xl p-3.5 shadow-2xs hover:border-emerald-200 transition-all min-w-0">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block truncate">
                  🤝 Active Deals
                </span>
                <p className="text-xl sm:text-2xl font-extrabold text-slate-900 mt-1 font-mono tracking-tight truncate">
                  {acceptedBidsCount}
                </p>
                <p className="text-[11px] text-emerald-600 font-semibold mt-0.5 truncate">
                  {myBids.length} Total Bids
                </p>
              </div>

              <div className="bg-white border border-slate-200/80 rounded-2xl p-3.5 shadow-2xs hover:border-amber-200 transition-all min-w-0">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block truncate">
                  🔐 Escrow Settlement
                </span>
                <p className="text-xl sm:text-2xl font-extrabold text-slate-900 mt-1 font-mono tracking-tight truncate">
                  Active
                </p>
                <p className="text-[11px] text-amber-600 font-semibold mt-0.5 truncate">
                  Sepolia Smart Contracts
                </p>
              </div>
            </div>

            {/* Featured Marketplace Products Preview */}
            <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-6 shadow-2xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 flex-wrap gap-2">
                <div>
                  <h3 className="text-sm sm:text-base font-extrabold text-slate-900">
                    🛍️ Featured Wholesale Products
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Traceable commercial bulk lots aggregated by verified FPOs
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setActiveNav("market")}
                  className="text-xs font-bold text-purple-700 hover:text-purple-800"
                >
                  Browse All ({fpoQuotes.length}) →
                </button>
              </div>

              {quotesLoading ? (
                <div className="py-12 text-center text-xs text-slate-400 animate-pulse">
                  Loading commercial catalog…
                </div>
              ) : fpoQuotes.length === 0 ? (
                <div className="py-12 text-center bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2">
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
                                Supplier: <strong>FPO #{quote.fpo}</strong>
                              </p>
                            </div>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200 shrink-0">
                              {quote.category}
                            </span>
                          </div>

                          <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between text-xs font-mono">
                            <div>
                              <span className="text-[10px] text-slate-400 font-bold uppercase block font-sans">Available</span>
                              <span className="font-extrabold text-slate-900 font-mono text-xs">
                                {avail} {quote.unit}
                              </span>
                            </div>
                            <div className="text-right">
                              <span className="text-[10px] text-slate-400 font-bold uppercase block font-sans">Rate</span>
                              <span className="font-bold text-purple-700 font-mono text-xs">
                                {quote.price_per_unit} ETH
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-1.5">
                          <button
                            type="button"
                            onClick={() => setActiveProductModal(quote)}
                            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl transition-all cursor-pointer"
                          >
                            View
                          </button>

                          <div className="flex items-center gap-1">
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

        {/* ══════════════════════════════════════════════════════════════ */}
        {/* VIEW 2: MARKET (Wholesale Catalog)                            */}
        {/* ══════════════════════════════════════════════════════════════ */}
        {activeNav === "market" && (
          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-6 shadow-2xs space-y-4 animate-fade-in">
            <div className="pb-3 border-b border-slate-100 flex items-center justify-between flex-wrap gap-2">
              <div>
                <h2 className="text-base font-extrabold text-slate-900">
                  🛍️ B2B Wholesale Commercial Catalog
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
              placeholder="Search wholesale products by name, category, or notes…"
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
                  const aiGrade = cp?.latest_ai_verification?.quality_grade || cp?.ai_grade;

                  return (
                    <div
                      key={quote.id}
                      className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-4.5 hover:border-purple-300 hover:shadow-xs transition-all flex flex-col justify-between gap-3 min-w-0"
                    >
                      <div className="space-y-2 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <h4 className="text-sm sm:text-base font-extrabold text-slate-900 truncate">
                              {quote.product_name}
                            </h4>
                            <p className="text-xs text-slate-500 truncate">
                              Supplier: <strong>{quote.fpo_name || `FPO #${quote.fpo}`}</strong>
                            </p>
                          </div>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200 shrink-0">
                            {quote.category}
                          </span>
                        </div>

                        {/* Image Preview if available */}
                        {quote.primary_image_url && (
                          <img
                            src={quote.primary_image_url}
                            alt={quote.product_name}
                            className="w-full h-32 object-cover rounded-xl border border-slate-200 shadow-xs"
                          />
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
                              {quote.price_per_unit} ETH
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                          {aiGrade && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                              Grade {aiGrade}
                            </span>
                          )}
                          <span className="text-[10px] font-semibold text-slate-500">
                            Deadline: {quote.deadline}
                          </span>
                        </div>
                      </div>

                      {/* Primary Actions: [View], [Negotiate], [Buy] */}
                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-1.5">
                        <button
                          type="button"
                          onClick={() => setActiveProductModal(quote)}
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
              <div className="py-12 text-center bg-slate-50/50 rounded-2xl border border-slate-100 space-y-2">
                <span className="text-4xl block">🔍</span>
                <p className="text-sm font-bold text-slate-800">No Wholesale Products Found</p>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  Try adjusting or clearing your search filters to view more listings.
                </p>
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════ */}
        {/* VIEW 3: DEALS (My Bids & Orders)                              */}
        {/* ══════════════════════════════════════════════════════════════ */}
        {activeNav === "deals" && (
          <div className="space-y-5 animate-fade-in">
            {/* My Submitted Bids */}
            <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-6 shadow-2xs space-y-4">
              <div className="pb-3 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h2 className="text-base font-extrabold text-slate-900">
                    📑 My Submitted Wholesale Bids ({myBids.length})
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Track status of your commercial procurement bids submitted to FPOs
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
                    const totalVal = calculateTotalEth(bid.bid_amount, bid.quote.quantity);
                    return (
                      <div
                        key={bid.id}
                        className="border border-slate-200/80 rounded-2xl p-4 bg-white hover:border-slate-300 transition-all space-y-3 shadow-2xs"
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="text-sm font-extrabold text-slate-900 truncate">
                              {bid.quote.product_name}
                            </p>
                            <span className="text-[11px] text-slate-500 font-medium">
                              {bid.quote.category}
                            </span>
                          </div>
                          <StatusBadge status={bid.status} />
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50/70 p-2.5 rounded-xl border border-slate-100 font-mono">
                          <div>
                            <span className="text-[10px] text-slate-400 font-bold uppercase block font-sans">Bid Rate</span>
                            <span className="font-extrabold text-slate-800">{bid.bid_amount} ETH/{bid.quote.unit}</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400 font-bold uppercase block font-sans">Delivery</span>
                            <span className="font-semibold text-slate-700 font-sans">{bid.delivery_time_days} days</span>
                          </div>
                          <div className="col-span-2 pt-1 border-t border-slate-200/60 flex items-center justify-between">
                            <span className="text-[10px] text-slate-400 font-bold uppercase font-sans">Total Value</span>
                            <span className="font-extrabold text-purple-700">{totalVal} ETH</span>
                          </div>
                        </div>

                        <div className="flex justify-end pt-1">
                          <button
                            type="button"
                            onClick={() => setNegotiatingBid({ bid: bid, contentType: "retailer.retailerbid" })}
                            className="px-3 py-1.5 bg-purple-100 hover:bg-purple-200 text-purple-900 text-xs font-bold rounded-xl border border-purple-300 transition-all cursor-pointer flex items-center gap-1"
                          >
                            <span>💬</span>
                            <span>Chat / Negotiate</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-12 text-center bg-slate-50/50 rounded-2xl border border-slate-100 space-y-2">
                  <span className="text-4xl block mb-2">📑</span>
                  <p className="text-sm font-bold text-slate-800">No Bids Submitted Yet</p>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto">
                    Browse open FPO quotes in the Market tab and submit your procurement offers.
                  </p>
                </div>
              )}
            </div>

            {/* Commercial Orders History */}
            <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-6 shadow-2xs">
              <RetailerOrdersPanel />
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════ */}
        {/* VIEW 4: CART (Temporary Checkout State)                       */}
        {/* ══════════════════════════════════════════════════════════════ */}
        {activeNav === "cart" && (
          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-6 shadow-2xs space-y-4 animate-fade-in">
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

        {/* ══════════════════════════════════════════════════════════════ */}
        {/* VIEW 5: INVENTORY (Permanent Purchased Stock)                 */}
        {/* ══════════════════════════════════════════════════════════════ */}
        {activeNav === "inventory" && (
          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-6 shadow-2xs space-y-4 animate-fade-in">
            <RetailerInventoryPanel />
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════ */}
        {/* VIEW 6: TRANSACTIONS (Escrow Deals)                           */}
        {/* ══════════════════════════════════════════════════════════════ */}
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

        {/* ══════════════════════════════════════════════════════════════ */}
        {/* VIEW 7: IDENTITY & VERIFICATION                               */}
        {/* ══════════════════════════════════════════════════════════════ */}
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
      </div>

      {/* ── Retailer Product Details Modal with Provenance Flow ─────── */}
      {activeProductModal && (
        <BaseModal
          isOpen={Boolean(activeProductModal)}
          onClose={() => setActiveProductModal(null)}
          title={activeProductModal.product_name}
          subtitle={`Wholesale Offer #${activeProductModal.id} · Supplied by ${activeProductModal.fpo_name || `FPO #${activeProductModal.fpo}`}`}
          icon="🛍️"
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
                className="w-full h-44 object-cover rounded-2xl border border-slate-200 shadow-xs"
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
                  {activeProductModal.price_per_unit} ETH/{activeProductModal.unit}
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

            {/* Visual Provenance Chain: Farmer → Crop Passport → FPO → Retailer Purchase */}
            <div className="bg-purple-50/50 border border-purple-200/80 rounded-2xl p-4 space-y-3">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-purple-900 block">
                ⛓️ Supply Chain Provenance Lineage
              </span>

              <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-xs">
                <div className="bg-white p-2.5 rounded-xl border border-purple-100 text-center flex-1 w-full">
                  <span className="text-base block mb-0.5">👨‍🌾</span>
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
                Your Offer (ETH / {activeBidQuote.unit}) *
              </label>
              <input
                type="number"
                step="any"
                min="0.000001"
                required
                placeholder="e.g. 0.005"
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
                <span className="text-purple-900 font-semibold">Estimated Total Value:</span>
                <span className="font-extrabold text-purple-950 font-mono text-sm">
                  {calculateTotalEth(bidAmountInput, activeBidQuote.quantity)} ETH
                </span>
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
