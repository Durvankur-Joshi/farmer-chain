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

// shadcn UI primitives
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

// Lucide icons
import {
  Sprout,
  Handshake,
  Package,
  ShieldCheck,
  Plus,
  ArrowRight,
  Sparkles,
} from "lucide-react";

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

  // Sub-view within Deals: "history" | "bids"
  const [dealViewMode, setDealViewMode] = useState("history");

  // shadcn Dialog state
  const [isAddCropOpen, setIsAddCropOpen] = useState(false);
  const [isCreateOfferOpen, setIsCreateOfferOpen] = useState(false);
  const [offerTargetCropId, setOfferTargetCropId] = useState(null);

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

  // Helper to open offers or create new offer for a crop
  const handleViewOffersForCrop = (crop) => {
    const matchingQuote = history.find(
      (q) => q.crop_passport === crop.id || q.crop_passport_details?.id === crop.id
    );
    if (matchingQuote) {
      setSelectedQuote(matchingQuote);
      setDealViewMode("bids");
      setActiveNav("deals");
    } else {
      setOfferTargetCropId(crop.id);
      setIsCreateOfferOpen(true);
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
    <div className="min-h-screen bg-slate-50/60 flex flex-col text-slate-900 font-sans">
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
            <Button
              type="button"
              onClick={() => setIsAddCropOpen(true)}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs flex items-center justify-center gap-2"
            >
              <Sprout className="h-4 w-4" />
              <span>+ Add Crop</span>
            </Button>
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
                <Button
                  type="button"
                  onClick={() => {
                    setIsAddCropOpen(true);
                    setIsMobileMenuOpen(false);
                  }}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs flex items-center justify-center gap-2"
                >
                  <Sprout className="h-4 w-4" />
                  <span>+ Add Crop</span>
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ── Main Content Area ─────────────────────────────────────── */}
        <main className="flex-1 min-w-0 p-3.5 sm:p-6 lg:p-7 space-y-6">
          {/* Mobile Quick Tab Navigation */}
          <div className="lg:hidden bg-white border border-slate-200/80 rounded-2xl p-1.5 shadow-2xs flex items-center justify-between gap-1 overflow-x-auto">
            {navItems.map((item) => {
              const isActive = activeNav === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => {
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
          {/* VIEW 1: DASHBOARD HOMEPAGE (shadcn dashboard-01 style)        */}
          {/* ══════════════════════════════════════════════════════════════ */}
          {activeNav === "dashboard" && (
            <div className="space-y-6 animate-fade-in">
              {/* Dashboard Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1 min-w-0">
                  <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 truncate">
                    Farmer Dashboard
                  </h1>
                  <p className="text-xs sm:text-sm text-slate-500">
                    Welcome back, {didInfo?.name || "Farmer"}. Manage your crop records, marketplace offers, and escrow payments.
                  </p>
                </div>

                {/* Primary Action Buttons */}
                <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
                  <Button
                    type="button"
                    onClick={() => setIsAddCropOpen(true)}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs gap-1.5"
                  >
                    <Sprout className="h-4 w-4" />
                    <span>+ Add Crop</span>
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setOfferTargetCropId(null);
                      setIsCreateOfferOpen(true);
                    }}
                    className="border-slate-300 hover:bg-slate-50 gap-1.5"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Create Offer</span>
                  </Button>
                </div>
              </div>

              {/* 4 Compact Metric Cards (dashboard-01 style) */}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {/* Metric 1: Crops */}
                <Card className="hover:border-emerald-300">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Your Crops
                    </CardTitle>
                    <Sprout className="h-4 w-4 text-emerald-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold font-mono text-slate-900 tracking-tight">
                      {crops.length}
                    </div>
                    <p className="text-xs text-emerald-700 font-medium mt-1">
                      {mintedCropsCount} Permanent Records
                    </p>
                  </CardContent>
                </Card>

                {/* Metric 2: Deals */}
                <Card className="hover:border-blue-300">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Active Deals
                    </CardTitle>
                    <Handshake className="h-4 w-4 text-blue-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold font-mono text-slate-900 tracking-tight">
                      {openQuotesCount}
                    </div>
                    <p className="text-xs text-blue-700 font-medium mt-1">
                      {activeBidsTotal} Buyer Offers
                    </p>
                  </CardContent>
                </Card>

                {/* Metric 3: Inventory Quantity */}
                <Card className="hover:border-purple-300">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Available Stock
                    </CardTitle>
                    <Package className="h-4 w-4 text-purple-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold font-mono text-slate-900 tracking-tight truncate">
                      {totalAvailableQuantity.toLocaleString()}
                    </div>
                    <p className="text-xs text-purple-700 font-medium mt-1">
                      Ready for Sale
                    </p>
                  </CardContent>
                </Card>

                {/* Metric 4: Secured Escrows */}
                <Card className="hover:border-amber-300">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Secured Payments
                    </CardTitle>
                    <ShieldCheck className="h-4 w-4 text-amber-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold font-mono text-slate-900 tracking-tight">
                      {escrowsCount}
                    </div>
                    <p className="text-xs text-amber-700 font-medium mt-1">
                      Blockchain Escrows
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Your Crops Section */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4 border-b border-slate-100 flex-wrap gap-2">
                  <div>
                    <CardTitle className="text-base font-bold text-slate-900">
                      Your Crop Records
                    </CardTitle>
                    <CardDescription>
                      Registered harvest records and availability status
                    </CardDescription>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setIsAddCropOpen(true)}
                      className="h-8 text-xs gap-1 text-emerald-800 border-emerald-200 bg-emerald-50/60 hover:bg-emerald-100"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>Add Crop</span>
                    </Button>
                    {crops.length > 4 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setActiveNav("crops")}
                        className="h-8 text-xs text-emerald-700 hover:text-emerald-800 gap-1"
                      >
                        <span>View All ({crops.length})</span>
                        <ArrowRight className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </CardHeader>

                <CardContent className="pt-4">
                  {cropsLoading ? (
                    <div className="py-12 text-center text-xs text-slate-400 animate-pulse">
                      Loading your crop records…
                    </div>
                  ) : crops.length === 0 ? (
                    <div className="py-12 text-center bg-slate-50/60 rounded-xl border border-dashed border-slate-200 space-y-3 p-6">
                      <span className="text-4xl block">🌾</span>
                      <h4 className="text-sm font-bold text-slate-800">No Crops Registered Yet</h4>
                      <p className="text-xs text-slate-500 max-w-sm mx-auto">
                        Add your first crop to create a secure digital record and start receiving offers from verified FPOs.
                      </p>
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => setIsAddCropOpen(true)}
                        className="gap-1.5"
                      >
                        <Sprout className="h-4 w-4" />
                        <span>Register First Crop</span>
                      </Button>
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
                </CardContent>
              </Card>

              {/* Active Deals / Incoming Offers Section */}
              {history.some((q) => q.bids?.length > 0) && (
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 border-b border-slate-100">
                    <div>
                      <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                        <Handshake className="h-4 w-4 text-emerald-600" />
                        <span>Active Deals & Incoming Offers</span>
                      </CardTitle>
                      <CardDescription>
                        Procurement proposals from verified FPOs awaiting your review
                      </CardDescription>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setDealViewMode("history");
                        setActiveNav("deals");
                      }}
                      className="h-8 text-xs text-emerald-700 hover:text-emerald-800 gap-1"
                    >
                      <span>View All Deals</span>
                      <ArrowRight className="h-3 w-3" />
                    </Button>
                  </CardHeader>

                  <CardContent className="pt-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {history
                        .filter((q) => q.bids?.length > 0)
                        .slice(0, 4)
                        .map((q) => (
                          <div
                            key={q.id}
                            className="flex items-center justify-between p-3.5 bg-slate-50/80 rounded-xl border border-slate-100 text-xs gap-3"
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

                            <Button
                              type="button"
                              size="sm"
                              onClick={() => {
                                setSelectedQuote(q);
                                setDealViewMode("bids");
                                setActiveNav("deals");
                              }}
                              className="h-7 px-3 text-xs"
                            >
                              Review Bids
                            </Button>
                          </div>
                        ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════ */}
          {/* VIEW 2: MY CROPS                                              */}
          {/* ══════════════════════════════════════════════════════════════ */}
          {activeNav === "crops" && (
            <Card className="animate-fade-in">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4 border-b border-slate-100 flex-wrap gap-2">
                <div>
                  <CardTitle className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                    <Sprout className="h-5 w-5 text-emerald-600" />
                    <span>My Crops</span>
                  </CardTitle>
                  <CardDescription>
                    Manage your registered crop lots and availability status.
                  </CardDescription>
                </div>

                <Button
                  type="button"
                  size="sm"
                  onClick={() => setIsAddCropOpen(true)}
                  className="gap-1.5"
                >
                  <Sprout className="h-4 w-4" />
                  <span>+ Add New Crop</span>
                </Button>
              </CardHeader>

              <CardContent className="pt-4 space-y-4">
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
                  <div className="py-12 text-center bg-slate-50/60 rounded-xl border border-dashed border-slate-200 space-y-3 p-6">
                    <span className="text-4xl block">🌾</span>
                    <h4 className="text-sm font-bold text-slate-800">No Crops Found</h4>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto">
                      {selectedCropCategory !== "All"
                        ? `No crops found in category "${selectedCropCategory}".`
                        : "Create your first crop record to assess quality with AI and attract FPO buyers."}
                    </p>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => {
                        setSelectedCropCategory("All");
                        setIsAddCropOpen(true);
                      }}
                      className="gap-1.5 mt-2"
                    >
                      <Sprout className="h-4 w-4" />
                      <span>Add New Crop</span>
                    </Button>
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
              </CardContent>
            </Card>
          )}

          {/* ══════════════════════════════════════════════════════════════ */}
          {/* VIEW 3: DEALS (Quotes, Bids & Negotiations)                   */}
          {/* ══════════════════════════════════════════════════════════════ */}
          {activeNav === "deals" && (
            <Card className="animate-fade-in">
              {dealViewMode === "history" && (
                <>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4 border-b border-slate-100 flex-wrap gap-2">
                    <div>
                      <CardTitle className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                        <Handshake className="h-5 w-5 text-emerald-600" />
                        <span>Deals & Supply Quotes</span>
                      </CardTitle>
                      <CardDescription>
                        Publish harvest quotes and review procurement offers from FPOs.
                      </CardDescription>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => {
                        setOfferTargetCropId(null);
                        setIsCreateOfferOpen(true);
                      }}
                      className="gap-1.5"
                    >
                      <Plus className="h-4 w-4" />
                      <span>Publish Quote</span>
                    </Button>
                  </CardHeader>

                  <CardContent className="pt-4">
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
                  </CardContent>
                </>
              )}

              {dealViewMode === "bids" && selectedQuote && (
                <CardContent className="pt-5">
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
                </CardContent>
              )}
            </Card>
          )}

          {/* ══════════════════════════════════════════════════════════════ */}
          {/* VIEW 4: TRANSACTIONS (Escrow Payments)                        */}
          {/* ══════════════════════════════════════════════════════════════ */}
          {activeNav === "transactions" && (
            <Card className="animate-fade-in">
              <CardHeader className="pb-4 border-b border-slate-100">
                <CardTitle className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-emerald-600" />
                  <span>Transactions & Payments</span>
                </CardTitle>
                <CardDescription>
                  Payment records and deliveries secured with FPO buyers via smart escrow contracts.
                </CardDescription>
              </CardHeader>

              <CardContent className="pt-4">
                <EscrowPanel
                  onEscrowUpdated={() => {
                    fetchEscrowSummary();
                    fetchHistory();
                  }}
                />
              </CardContent>
            </Card>
          )}

          {/* ══════════════════════════════════════════════════════════════ */}
          {/* VIEW 5: IDENTITY & VERIFICATION                               */}
          {/* ══════════════════════════════════════════════════════════════ */}
          {activeNav === "identity" && (
            <Card className="animate-fade-in">
              <CardHeader className="pb-4 border-b border-slate-100">
                <CardTitle className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-emerald-600" />
                  <span>Identity & Reputation Profile</span>
                </CardTitle>
                <CardDescription>
                  W3C Decentralized Identifier (DID) and multi-signal Web3 trust profile.
                </CardDescription>
              </CardHeader>

              <CardContent className="pt-5">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  <DidIdentityCard didInfo={didInfo} accentColor="emerald" />
                  <TrustReputationCard accentColor="green" />
                </div>
              </CardContent>
            </Card>
          )}
        </main>
      </div>

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* GLOBAL SHADCN DIALOGS                                          */}
      {/* ══════════════════════════════════════════════════════════════ */}

      {/* ── 1. "Add Crop" Dialog ───────────────────────────────────── */}
      <Dialog open={isAddCropOpen} onOpenChange={setIsAddCropOpen}>
        <DialogContent className="max-w-2xl max-h-[88vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <Sprout className="h-5 w-5 text-emerald-600" />
              <DialogTitle>Register Crop Lot</DialogTitle>
            </div>
            <DialogDescription>
              Record harvest lot specifications and initiate automated AI quality assessment.
            </DialogDescription>
          </DialogHeader>

          <CropPassportForm
            onSuccess={() => {
              fetchCrops();
              fetchDid();
              setIsAddCropOpen(false);
            }}
            onCancel={() => setIsAddCropOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* ── 2. "Create Offer" Dialog ───────────────────────────────── */}
      <Dialog open={isCreateOfferOpen} onOpenChange={setIsCreateOfferOpen}>
        <DialogContent className="max-w-xl max-h-[88vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-emerald-600" />
              <DialogTitle>Create Marketplace Offer</DialogTitle>
            </div>
            <DialogDescription>
              Publish verified harvest lot for competitive FPO bidding in INR (₹).
            </DialogDescription>
          </DialogHeader>

          <QuoteForm
            defaultPassportId={offerTargetCropId}
            onNavigateToPassports={() => {
              setIsCreateOfferOpen(false);
              setIsAddCropOpen(true);
            }}
            onSuccess={() => {
              fetchHistory();
              fetchCrops();
              fetchEscrowSummary();
              setIsCreateOfferOpen(false);
              setOfferTargetCropId(null);
            }}
            onCancel={() => {
              setIsCreateOfferOpen(false);
              setOfferTargetCropId(null);
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
