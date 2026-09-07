import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import Cookies from "js-cookie";
import { useNavigate } from "react-router-dom";
import { useRefreshSubscription } from "../../context/useRefresh";
import QuoteForm from "../../components/farmer/QuoteForm";
import QuoteHistory from "../../components/farmer/QuoteHistory";
import QuoteBids from "../../components/farmer/QuoteBids";
import CropPassportForm from "../../components/farmer/CropPassportForm";
import CropPassportCard from "../../components/farmer/CropPassportCard";
import EscrowPanel from "../../components/farmer/EscrowPanel";
import TrustReputationCard from "../../components/common/TrustReputationCard";
import DidIdentityCard from "../../components/common/DidIdentityCard";
import DashboardNavbar from "../../components/common/DashboardNavbar";

// activeNav values: "dashboard" | "crops" | "deals" | "transactions" | "identity"

export default function FarmerDashboard() {
  const navigate = useNavigate();
  const [activeNav, setActiveNav] = useState("dashboard");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [selectedCropCategory, setSelectedCropCategory] = useState("All");

  const [history, setHistory] = useState([]);
  const [quotesLoading, setQuotesLoading] = useState(true);
  const [selectedQuote, setSelectedQuote] = useState(null);
  const [didInfo, setDidInfo] = useState(null);
  const [crops, setCrops] = useState([]);
  const [cropsLoading, setCropsLoading] = useState(true);
  const [escrowsCount, setEscrowsCount] = useState(0);

  // Sub-view within Crops: "list" | "new"
  const [cropViewMode, setCropViewMode] = useState("list");
  // Sub-view within Deals: "history" | "new" | "bids"
  const [dealViewMode, setDealViewMode] = useState("history");

  // ── Logout ───────────────────────────────────────────────────────
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

  // ── Quote history ────────────────────────────────────────────────
  const fetchHistory = useCallback(async () => {
    setQuotesLoading(true);
    try {
      const res = await axios.get("/api/farmer/quotes/", { withCredentials: true });
      setHistory(res.data || []);
    } catch (err) {
      console.error("Error fetching quotes:", err);
    } finally {
      setQuotesLoading(false);
    }
  }, []);

  // ── DID identity ─────────────────────────────────────────────────
  const fetchDid = useCallback(async () => {
    try {
      const res = await axios.get("/api/did/me/", { withCredentials: true });
      setDidInfo(res.data);
    } catch (err) {
      console.error("Could not fetch DID:", err);
    }
  }, []);

  // ── Crop Passports ───────────────────────────────────────────────
  const fetchCrops = useCallback(async () => {
    setCropsLoading(true);
    try {
      const res = await axios.get("/api/farmer/crops/", { withCredentials: true });
      setCrops(res.data || []);
    } catch (err) {
      console.error("Error fetching crop passports:", err);
    } finally {
      setCropsLoading(false);
    }
  }, []);

  // ── Escrows Count ────────────────────────────────────────────────
  const fetchEscrowSummary = useCallback(async () => {
    try {
      const res = await axios.get("/api/escrow/my/", { withCredentials: true });
      setEscrowsCount(res.data?.escrows?.length || 0);
    } catch (err) {
      console.error("Error fetching escrow summary:", err);
    }
  }, []);

  useEffect(() => {
    fetchHistory();
    fetchDid();
    fetchCrops();
    fetchEscrowSummary();
  }, [fetchHistory, fetchDid, fetchCrops, fetchEscrowSummary]);

  useRefreshSubscription(["farmer", "quotes", "bids", "deals", "escrow"], () => {
    fetchHistory();
    fetchCrops();
    fetchEscrowSummary();
    fetchDid();
  });

  // Derived metrics
  const mintedCropsCount = crops.filter((c) => c.status === "minted").length;
  const openQuotesCount = history.filter((q) => q.status === "open").length;
  const activeBidsTotal = history.reduce((acc, q) => acc + (q.bids?.length || 0), 0);
  const totalAvailableQuantity = crops.reduce((acc, c) => {
    const qty = c.available_quantity !== undefined ? parseFloat(c.available_quantity) : parseFloat(c.quantity);
    return acc + (isNaN(qty) ? 0 : qty);
  }, 0);

  // Filter crops by category
  const filteredCrops = selectedCropCategory === "All"
    ? crops
    : crops.filter((c) => c.crop_category?.toLowerCase() === selectedCropCategory.toLowerCase());

  // Unique categories for filter pills
  const availableCategories = ["All", ...new Set(crops.map((c) => c.crop_category).filter(Boolean))];

  // Helper to open offers for a crop
  const handleViewOffersForCrop = (crop) => {
    const matchingQuote = history.find(
      (q) => q.crop_passport === crop.id || q.crop_passport_details?.id === crop.id
    );
    if (matchingQuote) {
      setSelectedQuote(matchingQuote);
      setDealViewMode("bids");
      setActiveNav("deals");
    } else {
      setDealViewMode("new");
      setActiveNav("deals");
    }
  };

  const navItems = [
    { key: "dashboard", label: "Dashboard", icon: "🏠" },
    {
      key: "crops",
      label: "My Crops",
      icon: "🌱",
      badge: crops.length > 0 ? crops.length : null,
    },
    {
      key: "deals",
      label: "Deals",
      icon: "🤝",
      badge: history.length > 0 ? history.length : null,
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
      {/* ── Top Dashboard Navbar ────────────────────────────────────── */}
      <DashboardNavbar
        role="farmer"
        userName={didInfo?.name || "Farmer"}
        didInfo={didInfo}
        onLogout={logout}
        onToggleMobileMenu={() => setIsMobileMenuOpen((prev) => !prev)}
      />

      {/* ── Application Layout Shell (Sidebar + Main Content) ─────────── */}
      <div className="flex flex-1 w-full max-w-7xl mx-auto min-w-0">
        {/* ── Desktop Left Sidebar (~240px) ─────────────────────────── */}
        <aside className="hidden lg:flex flex-col w-60 xl:w-64 shrink-0 bg-white border-r border-slate-200/80 p-4 space-y-4 sticky top-14 h-[calc(100vh-3.5rem)]">
          {/* Workspace Badge */}
          <div className="px-3 py-2 bg-emerald-50/70 border border-emerald-200/60 rounded-xl flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
            <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider truncate">
              Farm Workspace
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
                  onClick={() => {
                    if (item.key === "crops") setCropViewMode("list");
                    if (item.key === "deals") setDealViewMode("history");
                    setActiveNav(item.key);
                  }}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    isActive
                      ? "bg-emerald-600 text-white shadow-xs"
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
                          ? "bg-emerald-700/80 text-white"
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

          {/* Sidebar Quick Action Button */}
          <div className="pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => {
                setCropViewMode("new");
                setActiveNav("crops");
              }}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>🌱</span>
              <span>+ Add New Crop</span>
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
                    <span className="text-xl">🌾</span>
                    <span className="font-extrabold text-sm text-slate-900">Farm Workspace</span>
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
                          if (item.key === "crops") setCropViewMode("list");
                          if (item.key === "deals") setDealViewMode("history");
                          setActiveNav(item.key);
                          setIsMobileMenuOpen(false);
                        }}
                        className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                          isActive
                            ? "bg-emerald-600 text-white shadow-xs"
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
                                ? "bg-emerald-700/80 text-white"
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
                    setCropViewMode("new");
                    setActiveNav("crops");
                    setIsMobileMenuOpen(false);
                  }}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>🌱</span>
                  <span>+ Add New Crop</span>
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
                  onClick={() => {
                    if (item.key === "crops") setCropViewMode("list");
                    if (item.key === "deals") setDealViewMode("history");
                    setActiveNav(item.key);
                  }}
                  className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
                    isActive
                      ? "bg-emerald-600 text-white shadow-2xs"
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
          {/* VIEW 1: DASHBOARD HOMEPAGE                                     */}
          {/* ══════════════════════════════════════════════════════════════ */}
          {activeNav === "dashboard" && (
            <div className="space-y-5 animate-fade-in">
              {/* Clean Greeting Header with Prominent Primary Action */}
              <div className="bg-white border border-slate-200/80 rounded-3xl p-5 sm:p-6 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1 min-w-0">
                  <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight truncate">
                    Good morning, {didInfo?.name || "Farmer"}
                  </h1>
                  <p className="text-xs sm:text-sm text-slate-500">
                    Manage your crops, offers and sales.
                  </p>
                </div>

                {/* Primary Action Buttons */}
                <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
                  <button
                    type="button"
                    onClick={() => {
                      setCropViewMode("new");
                      setActiveNav("crops");
                    }}
                    className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>🌱</span>
                    <span>+ Add Your Crop</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDealViewMode("new");
                      setActiveNav("deals");
                    }}
                    className="px-3.5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>➕</span>
                    <span>+ Create Offer</span>
                  </button>
                </div>
              </div>

              {/* 4 Compact Summary Metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-white border border-slate-200/80 rounded-2xl p-3.5 shadow-2xs hover:border-emerald-200 transition-all min-w-0">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 block truncate">
                    🌱 Your Crop Records
                  </span>
                  <p className="text-xl sm:text-2xl font-bold text-slate-900 mt-1 font-mono tracking-tight truncate">
                    {crops.length}
                  </p>
                  <p className="text-[11px] text-emerald-700 font-medium mt-0.5 truncate">
                    {mintedCropsCount} Permanent Records
                  </p>
                </div>

                <div className="bg-white border border-slate-200/80 rounded-2xl p-3.5 shadow-2xs hover:border-blue-200 transition-all min-w-0">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 block truncate">
                    🤝 Active Deals
                  </span>
                  <p className="text-xl sm:text-2xl font-bold text-slate-900 mt-1 font-mono tracking-tight truncate">
                    {openQuotesCount}
                  </p>
                  <p className="text-[11px] text-blue-700 font-medium mt-0.5 truncate">
                    {activeBidsTotal} Buyer Offers
                  </p>
                </div>

                <div className="bg-white border border-slate-200/80 rounded-2xl p-3.5 shadow-2xs hover:border-purple-200 transition-all min-w-0">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 block truncate">
                    📦 Available Quantity
                  </span>
                  <p className="text-xl sm:text-2xl font-bold text-slate-900 mt-1 font-mono tracking-tight truncate">
                    {totalAvailableQuantity.toLocaleString()}
                  </p>
                  <p className="text-[11px] text-purple-700 font-medium mt-0.5 truncate">
                    Ready for Sale
                  </p>
                </div>

                <div className="bg-white border border-slate-200/80 rounded-2xl p-3.5 shadow-2xs hover:border-amber-200 transition-all min-w-0">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 block truncate">
                    🔒 Payment Secured
                  </span>
                  <p className="text-xl sm:text-2xl font-bold text-slate-900 mt-1 font-mono tracking-tight truncate">
                    {escrowsCount}
                  </p>
                  <p className="text-[11px] text-amber-700 font-medium mt-0.5 truncate">
                    Blockchain Escrows
                  </p>
                </div>
              </div>

              {/* Your Crops Section */}
              <div className="bg-white border border-slate-200/80 rounded-3xl p-5 sm:p-6 shadow-2xs space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 flex-wrap gap-2">
                  <div>
                    <h3 className="text-base font-semibold text-slate-900">
                      Your Crops
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Your registered harvest records and availability status
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setCropViewMode("new");
                        setActiveNav("crops");
                      }}
                      className="px-3.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-semibold rounded-xl border border-emerald-200 transition-all cursor-pointer flex items-center gap-1"
                    >
                      <span>➕</span>
                      <span>Add Crop</span>
                    </button>
                    {crops.length > 4 && (
                      <button
                        type="button"
                        onClick={() => {
                          setCropViewMode("list");
                          setActiveNav("crops");
                        }}
                        className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 cursor-pointer"
                      >
                        View All ({crops.length}) →
                      </button>
                    )}
                  </div>
                </div>

                {cropsLoading ? (
                  <div className="py-12 text-center text-xs text-slate-400 animate-pulse">
                    Loading your crops…
                  </div>
                ) : crops.length === 0 ? (
                  <div className="py-12 text-center bg-slate-50 rounded-2xl border border-slate-200/70 space-y-3 p-6">
                    <span className="text-4xl block">🌾</span>
                    <h4 className="text-sm font-bold text-slate-800">No Crops Registered Yet</h4>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto">
                      Add your first crop to create a secure digital record and start receiving offers from verified FPOs.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setCropViewMode("new");
                        setActiveNav("crops");
                      }}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-xs"
                    >
                      🌱 Register First Crop
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
                    {crops.slice(0, 6).map((crop) => {
                      const matchingQuote = history.find(
                        (q) => q.crop_passport === crop.id || q.crop_passport_details?.id === crop.id
                      );
                      const bidsCount = matchingQuote?.bids?.length || 0;

                      return (
                        <CropPassportCard
                          key={crop.id}
                          crop={crop}
                          hasActiveOffers={bidsCount > 0}
                          activeOffersCount={bidsCount}
                          onViewOffers={handleViewOffersForCrop}
                          onMintSuccess={() => {
                            fetchCrops();
                            fetchHistory();
                            fetchDid();
                          }}
                          onDeleteSuccess={() => {
                            fetchCrops();
                            fetchHistory();
                            fetchDid();
                          }}
                          onPassportUpdated={() => {
                            fetchCrops();
                            fetchDid();
                          }}
                        />
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Active Deals / Incoming Offers Section */}
              {history.some((q) => q.bids?.length > 0) && (
                <div className="bg-white border border-slate-200/80 rounded-3xl p-5 sm:p-6 shadow-2xs space-y-3.5">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <h3 className="text-xs font-semibold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                      <span>🤝</span>
                      <span>Active Deals & Incoming Offers</span>
                    </h3>
                    <button
                      type="button"
                      onClick={() => {
                        setDealViewMode("history");
                        setActiveNav("deals");
                      }}
                      className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 cursor-pointer"
                    >
                      View All Deals →
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {history
                      .filter((q) => q.bids?.length > 0)
                      .slice(0, 4)
                      .map((q) => (
                        <div
                          key={q.id}
                          className="flex items-center justify-between p-3.5 bg-slate-50/80 rounded-2xl border border-slate-100 text-xs gap-3"
                        >
                          <div className="min-w-0">
                            <span className="font-semibold text-slate-900 truncate block">
                              {q.product_name}
                            </span>
                            <span className="text-[11px] text-slate-500 font-mono block">
                              {q.quantity} {q.unit}
                            </span>
                            <span className="text-[11px] text-emerald-700 font-medium block mt-0.5">
                              {q.bids.length} FPO Bid(s) waiting
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              setSelectedQuote(q);
                              setDealViewMode("bids");
                              setActiveNav("deals");
                            }}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl transition-all cursor-pointer shrink-0 shadow-2xs"
                          >
                            Review Bids
                          </button>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════ */}
          {/* VIEW 2: MY CROPS                                              */}
          {/* ══════════════════════════════════════════════════════════════ */}
          {activeNav === "crops" && (
            <div className="bg-white border border-slate-200/80 rounded-3xl p-5 sm:p-7 shadow-2xs space-y-5 animate-fade-in">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 flex-wrap gap-2">
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-slate-900">
                    🌱 My Crops
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Manage your crop records and availability.
                  </p>
                </div>

                {cropViewMode === "list" ? (
                  <button
                    type="button"
                    onClick={() => setCropViewMode("new")}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>🌱</span>
                    <span>+ Add New Crop</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setCropViewMode("list")}
                    className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-all cursor-pointer"
                  >
                    ← Back to My Crops
                  </button>
                )}
              </div>

              {cropViewMode === "new" ? (
                <CropPassportForm
                  onSuccess={() => {
                    fetchCrops();
                    fetchDid();
                    setCropViewMode("list");
                  }}
                  onCancel={() => setCropViewMode("list")}
                />
              ) : (
                <div className="space-y-4">
                  {/* Category Filter Pills */}
                  {crops.length > 0 && availableCategories.length > 2 && (
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                      {availableCategories.map((cat) => (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setSelectedCropCategory(cat)}
                          className={`px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer shrink-0 ${
                            selectedCropCategory === cat
                              ? "bg-emerald-600 text-white shadow-2xs"
                              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                          }`}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  )}

                  {cropsLoading ? (
                    <div className="py-12 text-center text-xs text-slate-400 animate-pulse">
                      Loading crop records…
                    </div>
                  ) : filteredCrops.length === 0 ? (
                    <div className="py-12 text-center bg-slate-50 rounded-2xl border border-slate-200/80 space-y-3 p-6">
                      <span className="text-4xl block">🌾</span>
                      <h4 className="text-sm font-bold text-slate-800">No Crops Found</h4>
                      <p className="text-xs text-slate-500 max-w-sm mx-auto">
                        {selectedCropCategory !== "All"
                          ? `No crops found in category "${selectedCropCategory}".`
                          : "Create your first crop record to assess quality with AI and attract FPO buyers."}
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedCropCategory("All");
                          setCropViewMode("new");
                        }}
                        className="mt-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-xs"
                      >
                        🌱 Add New Crop
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
                      {filteredCrops.map((crop) => (
                        <CropPassportCard
                          key={crop.id}
                          crop={crop}
                          onViewOffers={handleViewOffersForCrop}
                          onMintSuccess={() => {
                            fetchCrops();
                            fetchHistory();
                            fetchDid();
                          }}
                          onDeleteSuccess={() => {
                            fetchCrops();
                            fetchHistory();
                            fetchDid();
                          }}
                          onPassportUpdated={() => {
                            fetchCrops();
                            fetchDid();
                          }}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════ */}
          {/* VIEW 3: DEALS (Quotes, Bids & Negotiations)                   */}
          {/* ══════════════════════════════════════════════════════════════ */}
          {activeNav === "deals" && (
            <div className="bg-white border border-slate-200/80 rounded-3xl p-5 sm:p-7 shadow-2xs space-y-4 animate-fade-in">
              {dealViewMode === "history" && (
                <>
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100 flex-wrap gap-2">
                    <div>
                      <h2 className="text-base sm:text-lg font-bold text-slate-900">
                        🤝 Deals & Supply Quotes
                      </h2>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Publish harvest quotes and review procurement offers from FPOs.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setDealViewMode("new")}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                    >
                      <span>➕</span>
                      <span>Publish Quote</span>
                    </button>
                  </div>

                  {quotesLoading ? (
                    <div className="py-12 text-center text-xs text-slate-400 animate-pulse">
                      Loading supply quotes…
                    </div>
                  ) : (
                    <QuoteHistory
                      history={history}
                      onViewBids={(quote) => {
                        setSelectedQuote(quote);
                        setDealViewMode("bids");
                      }}
                    />
                  )}
                </>
              )}

              {dealViewMode === "new" && (
                <div>
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
                    <div>
                      <h2 className="text-base sm:text-lg font-bold text-slate-900">
                        ➕ Publish Supply Quote
                      </h2>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Publish harvest specifications for verified FPO bidding.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setDealViewMode("history")}
                      className="text-xs font-semibold text-slate-500 hover:text-slate-800"
                    >
                      ← Back to Quotes
                    </button>
                  </div>

                  <QuoteForm
                    onNavigateToPassports={() => {
                      setCropViewMode("list");
                      setActiveNav("crops");
                    }}
                    onSuccess={() => {
                      fetchHistory();
                      fetchCrops();
                      fetchEscrowSummary();
                      setDealViewMode("history");
                    }}
                  />
                </div>
              )}

              {dealViewMode === "bids" && selectedQuote && (
                <QuoteBids
                  quote={selectedQuote}
                  onBack={() => setDealViewMode("history")}
                  refreshHistory={fetchHistory}
                  onQuoteUpdated={(acceptedBidId) => {
                    if (acceptedBidId) {
                      setSelectedQuote((prev) => {
                        if (!prev) return prev;
                        return {
                          ...prev,
                          status: "accepted",
                          accepted_bid: acceptedBidId,
                          bids: (prev.bids || []).map((b) =>
                            b.id === acceptedBidId ? { ...b, status: "accepted" } : b
                          ),
                        };
                      });
                    }
                    fetchHistory();
                    fetchEscrowSummary();
                  }}
                />
              )}
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════ */}
          {/* VIEW 4: TRANSACTIONS (Escrow Payments)                        */}
          {/* ══════════════════════════════════════════════════════════════ */}
          {activeNav === "transactions" && (
            <div className="bg-white border border-slate-200/80 rounded-3xl p-5 sm:p-7 shadow-2xs space-y-4 animate-fade-in">
              <div className="pb-3 border-b border-slate-100">
                <h2 className="text-base sm:text-lg font-bold text-slate-900">
                  💰 Transactions & Payments
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Payment records and deliveries secured with FPO buyers.
                </p>
              </div>

              <EscrowPanel
                onEscrowUpdated={() => {
                  fetchEscrowSummary();
                  fetchHistory();
                }}
              />
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════ */}
          {/* VIEW 5: IDENTITY & VERIFICATION                               */}
          {/* ══════════════════════════════════════════════════════════════ */}
          {activeNav === "identity" && (
            <div className="bg-white border border-slate-200/80 rounded-3xl p-5 sm:p-7 shadow-2xs space-y-5 animate-fade-in">
              <div className="pb-3 border-b border-slate-100">
                <h2 className="text-base sm:text-lg font-bold text-slate-900">
                  🪪 Identity & Reputation Profile
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  W3C Decentralized Identifier (DID) and multi-signal Web3 trust profile.
                </p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <DidIdentityCard didInfo={didInfo} accentColor="emerald" />
                <TrustReputationCard accentColor="green" />
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
