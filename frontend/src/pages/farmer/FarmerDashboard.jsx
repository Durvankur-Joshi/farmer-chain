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

  // Helper to open offers for a crop
  const handleViewOffersForCrop = (crop) => {
    // Find matching quote for this crop if one exists
    const matchingQuote = history.find(
      (q) => q.crop_passport === crop.id || q.crop_passport_details?.id === crop.id
    );
    if (matchingQuote) {
      setSelectedQuote(matchingQuote);
      setDealViewMode("bids");
      setActiveNav("deals");
    } else {
      // Navigate to create a quote for this crop
      setDealViewMode("new");
      setActiveNav("deals");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col text-slate-900 font-sans">
      {/* ── Top Dashboard Navbar ────────────────────────────────────── */}
      <DashboardNavbar
        role="farmer"
        userName={didInfo?.name || "Farmer"}
        didInfo={didInfo}
        onLogout={logout}
      />

      <div className="max-w-6xl mx-auto w-full px-3.5 sm:px-6 py-5 sm:py-7 flex-1 space-y-5 min-w-0">

        {/* ── Compact Role Navigation Bar ────────────────────────────── */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-1.5 shadow-2xs flex items-center justify-between gap-1 overflow-x-auto">
          <div className="flex items-center gap-1 min-w-max">
            <button
              type="button"
              onClick={() => setActiveNav("dashboard")}
              className={`py-2 px-3 sm:px-4 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeNav === "dashboard"
                  ? "bg-emerald-600 text-white shadow-2xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
              }`}
            >
              <span>🌾</span>
              <span>Dashboard</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setCropViewMode("list");
                setActiveNav("crops");
              }}
              className={`py-2 px-3 sm:px-4 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeNav === "crops"
                  ? "bg-emerald-600 text-white shadow-2xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
              }`}
            >
              <span>🌱</span>
              <span>My Crops</span>
              {crops.length > 0 && (
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                  activeNav === "crops" ? "bg-emerald-700/80 text-white" : "bg-slate-100 text-slate-600"
                }`}>
                  {crops.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                setDealViewMode("history");
                setActiveNav("deals");
              }}
              className={`py-2 px-3 sm:px-4 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeNav === "deals"
                  ? "bg-emerald-600 text-white shadow-2xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
              }`}
            >
              <span>🤝</span>
              <span>Deals</span>
              {history.length > 0 && (
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                  activeNav === "deals" ? "bg-emerald-700/80 text-white" : "bg-slate-100 text-slate-600"
                }`}>
                  {history.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveNav("transactions")}
              className={`py-2 px-3 sm:px-4 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeNav === "transactions"
                  ? "bg-emerald-600 text-white shadow-2xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
              }`}
            >
              <span>💰</span>
              <span>Transactions</span>
              {escrowsCount > 0 && (
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                  activeNav === "transactions" ? "bg-emerald-700/80 text-white" : "bg-slate-100 text-slate-600"
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
                  ? "bg-emerald-600 text-white shadow-2xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
              }`}
            >
              <span>🪪</span>
              <span>Identity</span>
            </button>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════ */}
        {/* VIEW 1: DASHBOARD (Simple Farm Workspace)                      */}
        {/* ══════════════════════════════════════════════════════════════ */}
        {activeNav === "dashboard" && (
          <div className="space-y-5 animate-fade-in">
            {/* Clean Farm Workspace Header with Quick Actions */}
            <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-6 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                  <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">
                    Simple Farm Workspace
                  </span>
                </div>
                <h1 className="text-lg sm:text-2xl font-extrabold text-slate-900 tracking-tight truncate">
                  Welcome back, {didInfo?.name || "Farmer"}
                </h1>
                <p className="text-xs text-slate-500 max-w-xl">
                  Manage digital crop passports, respond to verified FPO procurement offers, and receive trustless escrow payouts.
                </p>
              </div>

              {/* Primary Actions */}
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setCropViewMode("new");
                    setActiveNav("crops");
                  }}
                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <span>🌾</span>
                  <span>Register Crop</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDealViewMode("new");
                    setActiveNav("deals");
                  }}
                  className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <span>➕</span>
                  <span>Publish Quote</span>
                </button>
              </div>
            </div>

            {/* 4 Compact Summary Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-white border border-slate-200/80 rounded-2xl p-3.5 shadow-2xs hover:border-emerald-200 transition-all min-w-0">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block truncate">
                  🌾 My Crops
                </span>
                <p className="text-xl sm:text-2xl font-extrabold text-slate-900 mt-1 font-mono tracking-tight truncate">
                  {crops.length}
                </p>
                <p className="text-[11px] text-emerald-600 font-semibold mt-0.5 truncate">
                  {mintedCropsCount} Minted NFTs
                </p>
              </div>

              <div className="bg-white border border-slate-200/80 rounded-2xl p-3.5 shadow-2xs hover:border-blue-200 transition-all min-w-0">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block truncate">
                  🤝 Active Deals
                </span>
                <p className="text-xl sm:text-2xl font-extrabold text-slate-900 mt-1 font-mono tracking-tight truncate">
                  {openQuotesCount}
                </p>
                <p className="text-[11px] text-blue-600 font-semibold mt-0.5 truncate">
                  {activeBidsTotal} Bids Received
                </p>
              </div>

              <div className="bg-white border border-slate-200/80 rounded-2xl p-3.5 shadow-2xs hover:border-amber-200 transition-all min-w-0">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block truncate">
                  💰 Sales & Escrows
                </span>
                <p className="text-xl sm:text-2xl font-extrabold text-slate-900 mt-1 font-mono tracking-tight truncate">
                  {escrowsCount}
                </p>
                <p className="text-[11px] text-amber-600 font-semibold mt-0.5 truncate">
                  Sepolia Contracts
                </p>
              </div>

              <div className="bg-white border border-slate-200/80 rounded-2xl p-3.5 shadow-2xs hover:border-purple-200 transition-all min-w-0">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block truncate">
                  📦 Available Quantity
                </span>
                <p className="text-xl sm:text-2xl font-extrabold text-slate-900 mt-1 font-mono tracking-tight truncate">
                  {totalAvailableQuantity.toLocaleString()}
                </p>
                <p className="text-[11px] text-purple-600 font-semibold mt-0.5 truncate">
                  Ready for Harvest Sale
                </p>
              </div>
            </div>

            {/* Main Content: My Crop Passports (Compact Cards Grid) */}
            <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-6 shadow-2xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 flex-wrap gap-2">
                <div>
                  <h3 className="text-sm sm:text-base font-extrabold text-slate-900">
                    🌾 My Crop Passports
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Verified digital harvest records with IPFS decentralized proofs
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setCropViewMode("new");
                    setActiveNav("crops");
                  }}
                  className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold rounded-xl border border-emerald-200 transition-all cursor-pointer flex items-center gap-1"
                >
                  <span>➕</span>
                  <span>Register Crop</span>
                </button>
              </div>

              {cropsLoading ? (
                <div className="py-12 text-center text-xs text-slate-400 animate-pulse">
                  Loading farm crops…
                </div>
              ) : crops.length === 0 ? (
                <div className="py-12 text-center bg-slate-50 rounded-2xl border border-slate-200/70 space-y-2">
                  <span className="text-4xl block">🌾</span>
                  <p className="text-sm font-bold text-slate-800">No Crop Passports Registered Yet</p>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    Register your first crop lot to create an on-chain digital twin and attract FPO procurement offers.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setCropViewMode("new");
                      setActiveNav("crops");
                    }}
                    className="mt-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-xs"
                  >
                    ➕ Register First Crop
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {crops.map((crop) => {
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

            {/* Active Deals / Incoming Offers Quick Preview */}
            {history.some((q) => q.bids?.length > 0) && (
              <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 shadow-2xs space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                    <span>🤝</span>
                    <span>Incoming FPO Procurement Bids</span>
                  </h3>
                  <button
                    type="button"
                    onClick={() => {
                      setDealViewMode("history");
                      setActiveNav("deals");
                    }}
                    className="text-xs font-bold text-emerald-700 hover:text-emerald-800"
                  >
                    View All Deals →
                  </button>
                </div>

                <div className="space-y-2">
                  {history
                    .filter((q) => q.bids?.length > 0)
                    .slice(0, 3)
                    .map((q) => (
                      <div
                        key={q.id}
                        className="flex items-center justify-between p-3 bg-slate-50/80 rounded-xl border border-slate-100 text-xs gap-3"
                      >
                        <div className="min-w-0">
                          <span className="font-extrabold text-slate-900 truncate block">
                            {q.product_name} ({q.quantity} {q.unit})
                          </span>
                          <span className="text-[11px] text-slate-500 truncate block">
                            {q.bids.length} FPO Bid(s) waiting for review
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            setSelectedQuote(q);
                            setDealViewMode("bids");
                            setActiveNav("deals");
                          }}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg transition-all cursor-pointer shrink-0"
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
          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-6 shadow-2xs space-y-4 animate-fade-in">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 flex-wrap gap-2">
              <div>
                <h2 className="text-base font-extrabold text-slate-900">
                  🌱 My Crops & Digital Twin Passports
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Register, verify with Gemini AI, and mint immutable ERC-721 tokens on Sepolia
                </p>
              </div>

              {cropViewMode === "list" ? (
                <button
                  type="button"
                  onClick={() => setCropViewMode("new")}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition-all shadow-xs flex items-center gap-1 cursor-pointer"
                >
                  <span>➕</span>
                  <span>Register Crop Lot</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setCropViewMode("list")}
                  className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all cursor-pointer"
                >
                  ← Back to Crops List
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
              <div>
                {cropsLoading ? (
                  <div className="py-12 text-center text-xs text-slate-400 animate-pulse">
                    Loading crop passports…
                  </div>
                ) : crops.length === 0 ? (
                  <div className="py-12 text-center bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2">
                    <span className="text-4xl block">🌾</span>
                    <p className="text-sm font-bold text-slate-800">No Crop Passports Registered Yet</p>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto">
                      Create your first crop passport to pin IPFS evidence and assess quality with AI.
                    </p>
                    <button
                      type="button"
                      onClick={() => setCropViewMode("new")}
                      className="mt-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-xs"
                    >
                      ➕ Register First Crop
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                    {crops.map((crop) => (
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
          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-6 shadow-2xs space-y-4 animate-fade-in">
            {dealViewMode === "history" && (
              <>
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 flex-wrap gap-2">
                  <div>
                    <h2 className="text-base font-extrabold text-slate-900">
                      📜 My Supply Quotes & Deals
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Publish crop harvest lots for FPO procurement bidding
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDealViewMode("new")}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>➕</span>
                    <span>New Quote</span>
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
                    <h2 className="text-base font-extrabold text-slate-900">
                      ➕ Create New Supply Quote
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Publish harvest specifications for verified FPO bidding
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
          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-6 shadow-2xs space-y-4 animate-fade-in">
            <div className="pb-3 border-b border-slate-100">
              <h2 className="text-base font-extrabold text-slate-900">
                💰 Transactions & Escrow Settlement
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Trustless payment locks on Ethereum Sepolia between Farmer and FPO
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
          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-6 shadow-2xs space-y-5 animate-fade-in">
            <div className="pb-3 border-b border-slate-100">
              <h2 className="text-base font-extrabold text-slate-900">
                🪪 Identity & Decentralized Trust Profile
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                W3C Decentralized Identifier (DID) and multi-signal Web3 reputation
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <DidIdentityCard didInfo={didInfo} accentColor="emerald" />
              <TrustReputationCard accentColor="green" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
