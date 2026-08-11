import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import Cookies from "js-cookie";
import { useNavigate } from "react-router-dom";
import QuoteForm from "../../components/farmer/QuoteForm";
import QuoteHistory from "../../components/farmer/QuoteHistory";
import QuoteBids from "../../components/farmer/QuoteBids";
import CropPassportForm from "../../components/farmer/CropPassportForm";
import CropPassportCard from "../../components/farmer/CropPassportCard";
import EscrowPanel from "../../components/farmer/EscrowPanel";
import TrustReputationCard from "../../components/common/TrustReputationCard";
import DidIdentityCard from "../../components/common/DidIdentityCard";
import DashboardNavbar from "../../components/common/DashboardNavbar";

// activePage values: "history" | "newQuote" | "bids" | "crops" | "newCrop" | "escrow" | "identity"

export default function FarmerDashboard() {
  const navigate = useNavigate();
  const [history, setHistory] = useState([]);
  const [quotesLoading, setQuotesLoading] = useState(true);
  const [activePage, setActivePage] = useState("history");
  const [selectedQuote, setSelectedQuote] = useState(null);
  const [didInfo, setDidInfo] = useState(null);
  const [crops, setCrops] = useState([]);
  const [cropsLoading, setCropsLoading] = useState(true);
  const [escrowsCount, setEscrowsCount] = useState(0);

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

  // ── Fetch Escrows Count (real data only) ─────────────────────────
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

  // Derived real metrics
  const mintedCropsCount = crops.filter((c) => c.status === "minted").length;
  const openQuotesCount = history.filter((q) => q.status === "open").length;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col text-slate-900 font-sans">
      {/* ── Top Dashboard Navbar ────────────────────────────────────── */}
      <DashboardNavbar
        role="farmer"
        userName={didInfo?.name || "Farmer"}
        didInfo={didInfo}
        onLogout={logout}
      />

      <div className="max-w-6xl mx-auto w-full px-4 sm:px-6 py-6 sm:py-8 flex-1 space-y-6">

        {/* ── Welcome & Overview Banner ─────────────────────────────── */}
        <div className="bg-gradient-to-r from-emerald-800 to-green-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
          <div className="absolute top-[-20%] right-[-10%] w-[40%] h-[140%] rounded-full bg-white/5 blur-2xl pointer-events-none" />
          
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-700/80 border border-emerald-500/40 text-emerald-100">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Verified Agricultural Producer
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                Welcome back, {didInfo?.name || "Farmer"}
              </h1>
              <p className="text-xs sm:text-sm text-emerald-100/80 max-w-xl">
                Manage your digital crop twins, track decentralized IPFS evidence, accept FPO procurement bids, and receive escrow payments securely.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => setActivePage("newCrop")}
                className="bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-all shadow-md shadow-purple-900/30 flex items-center gap-1.5 cursor-pointer"
              >
                <span>🌾</span>
                <span>Register Crop Lot</span>
              </button>
              <button
                type="button"
                onClick={() => setActivePage("newQuote")}
                className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-extrabold px-4 py-2.5 rounded-xl transition-all shadow-md shadow-emerald-950/30 flex items-center gap-1.5 cursor-pointer"
              >
                <span>➕</span>
                <span>Publish Quote</span>
              </button>
            </div>
          </div>
        </div>

        {/* ── Summary Key Metrics Bar (Real Data Only) ──────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-2xs hover:border-emerald-200 transition-all">
            <div className="flex justify-between items-start">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Supply Quotes</span>
              <span className="text-lg">📜</span>
            </div>
            <p className="text-2xl font-extrabold text-slate-900 mt-1 tracking-tight">
              {history.length}
            </p>
            <p className="text-[11px] text-emerald-600 font-semibold mt-0.5">
              {openQuotesCount} Open for Bidding
            </p>
          </div>

          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-2xs hover:border-purple-200 transition-all">
            <div className="flex justify-between items-start">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Crop Passports</span>
              <span className="text-lg">🌾</span>
            </div>
            <p className="text-2xl font-extrabold text-slate-900 mt-1 tracking-tight">
              {crops.length}
            </p>
            <p className="text-[11px] text-purple-600 font-semibold mt-0.5">
              {mintedCropsCount} Minted on Sepolia
            </p>
          </div>

          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-2xs hover:border-amber-200 transition-all">
            <div className="flex justify-between items-start">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Escrow Contracts</span>
              <span className="text-lg">🔐</span>
            </div>
            <p className="text-2xl font-extrabold text-slate-900 mt-1 tracking-tight">
              {escrowsCount}
            </p>
            <p className="text-[11px] text-amber-600 font-semibold mt-0.5">
              Trustless Smart Contracts
            </p>
          </div>

          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-2xs hover:border-blue-200 transition-all">
            <div className="flex justify-between items-start">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Identity Status</span>
              <span className="text-lg">🛡️</span>
            </div>
            <p className="text-base font-extrabold text-slate-900 mt-2 truncate">
              {didInfo?.did ? "W3C Verified" : "Pending DID"}
            </p>
            <p className="text-[11px] text-blue-600 font-semibold mt-0.5">
              Role: Farmer
            </p>
          </div>
        </div>

        {/* ── DID & Trust Score Side-by-Side Grid ───────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <DidIdentityCard didInfo={didInfo} accentColor="emerald" />
          <TrustReputationCard accentColor="green" />
        </div>

        {/* ── Segmented Tab Navigation ──────────────────────────────── */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-1.5 shadow-2xs flex flex-wrap gap-1">
          <button
            type="button"
            onClick={() => setActivePage("history")}
            className={`flex-1 min-w-[130px] py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activePage === "history" || activePage === "newQuote" || activePage === "bids"
                ? "bg-emerald-600 text-white shadow-sm"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
            }`}
          >
            <span>📜</span>
            <span>Supply Quotes</span>
            {history.length > 0 && (
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                activePage === "history" || activePage === "newQuote" || activePage === "bids"
                  ? "bg-emerald-700/80 text-white"
                  : "bg-slate-100 text-slate-600"
              }`}>
                {history.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActivePage("crops")}
            className={`flex-1 min-w-[130px] py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activePage === "crops" || activePage === "newCrop"
                ? "bg-purple-600 text-white shadow-sm"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
            }`}
          >
            <span>🌾</span>
            <span>Crop Passports</span>
            {crops.length > 0 && (
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                activePage === "crops" || activePage === "newCrop"
                  ? "bg-purple-700/80 text-white"
                  : "bg-slate-100 text-slate-600"
              }`}>
                {crops.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActivePage("escrow")}
            className={`flex-1 min-w-[130px] py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activePage === "escrow"
                ? "bg-amber-600 text-white shadow-sm"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
            }`}
          >
            <span>🔐</span>
            <span>Escrow Payments</span>
            {escrowsCount > 0 && (
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                activePage === "escrow"
                  ? "bg-amber-700/80 text-white"
                  : "bg-slate-100 text-slate-600"
              }`}>
                {escrowsCount}
              </span>
            )}
          </button>
        </div>

        {/* ── Tab Content Panels ────────────────────────────────────── */}

        {/* Quotes Section */}
        {(activePage === "history" || activePage === "newQuote" || activePage === "bids") && (
          <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs">
            {activePage === "history" && (
              <>
                <div className="flex justify-between items-center mb-5 pb-3 border-b border-slate-100">
                  <div>
                    <h2 className="text-base font-extrabold text-slate-900">
                      📜 My Supply Quotes
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Publish crop lots for FPO bidding and direct procurement
                    </p>
                  </div>
                  <button
                    onClick={() => setActivePage("newQuote")}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-4 py-2 rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
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
                      setActivePage("bids");
                    }}
                  />
                )}
              </>
            )}

            {activePage === "newQuote" && (
              <div>
                <div className="flex justify-between items-center mb-5 pb-3 border-b border-slate-100">
                  <div>
                    <h2 className="text-base font-extrabold text-slate-900">
                      ➕ Create New Supply Quote
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Publish your crop specifications for verified FPO bidding
                    </p>
                  </div>
                  <button
                    onClick={() => setActivePage("history")}
                    className="text-xs font-semibold text-slate-500 hover:text-slate-800"
                  >
                    ← Back to Quotes
                  </button>
                </div>
                <QuoteForm
                  onNavigateToPassports={() => setActivePage("crops")}
                  onSuccess={() => {
                    fetchHistory();
                    setActivePage("history");
                  }}
                />
              </div>
            )}

            {activePage === "bids" && selectedQuote && (
              <QuoteBids
                quote={selectedQuote}
                onBack={() => setActivePage("history")}
                refreshHistory={fetchHistory}
              />
            )}
          </div>
        )}

        {/* Crop Passport Section */}
        {(activePage === "crops" || activePage === "newCrop") && (
          <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs">
            <div className="flex justify-between items-center mb-5 pb-3 border-b border-slate-100">
              <div>
                <h2 className="text-base font-extrabold text-purple-900">
                  🌾 NFT Crop Passports
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  On-chain crop digital twins with IPFS evidence and Gemini AI quality verification
                </p>
              </div>
              {activePage === "crops" && (
                <button
                  onClick={() => setActivePage("newCrop")}
                  className="bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold px-4 py-2 rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <span>➕</span>
                  <span>Register Crop Lot</span>
                </button>
              )}
              {activePage === "newCrop" && (
                <button
                  onClick={() => setActivePage("crops")}
                  className="text-xs font-semibold text-slate-500 hover:text-slate-800"
                >
                  ← Back to Passports
                </button>
              )}
            </div>

            {activePage === "newCrop" && (
              <CropPassportForm
                onSuccess={() => {
                  fetchCrops();
                  setActivePage("crops");
                }}
                onCancel={() => setActivePage("crops")}
              />
            )}

            {activePage === "crops" && (
              <>
                {cropsLoading ? (
                  <div className="py-12 text-center text-slate-400 text-xs animate-pulse">
                    Loading crop passports…
                  </div>
                ) : crops.length === 0 ? (
                  <div className="bg-purple-50/50 border border-purple-100 rounded-2xl p-10 text-center">
                    <span className="text-4xl block mb-3">🌾</span>
                    <p className="text-purple-900 font-bold text-base">No Crop Passports Registered Yet</p>
                    <p className="text-slate-500 text-xs mt-1 max-w-sm mx-auto">
                      Create your first digital crop passport to pin decentralized evidence to IPFS, get automated AI quality assessments, and mint on Sepolia.
                    </p>
                    <button
                      onClick={() => setActivePage("newCrop")}
                      className="mt-4 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-xs"
                    >
                      ➕ Register First Crop
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {crops.map((crop) => (
                      <CropPassportCard
                        key={crop.id}
                        crop={crop}
                        onMintSuccess={() => {
                          fetchCrops();
                          fetchHistory();
                        }}
                        onDeleteSuccess={() => {
                          fetchCrops();
                          fetchHistory();
                        }}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Escrow Section */}
        {activePage === "escrow" && (
          <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs">
            <div className="mb-5 pb-3 border-b border-slate-100">
              <h2 className="text-base font-extrabold text-amber-900">
                🔐 Smart Contract Escrow Payments
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Trustless payment locks on Ethereum Sepolia between Farmer and FPO
              </p>
            </div>
            <EscrowPanel />
          </div>
        )}
      </div>
    </div>
  );
}
