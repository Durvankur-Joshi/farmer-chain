import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import Cookies from "js-cookie";
import { useNavigate } from "react-router-dom";
import TrustReputationCard from "../../components/common/TrustReputationCard";
import DidIdentityCard from "../../components/common/DidIdentityCard";
import DashboardNavbar from "../../components/common/DashboardNavbar";
import StatusBadge from "../../components/common/StatusBadge";

export default function RetailerDashboard() {
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState("quotes");
  const [fpoQuotes, setFpoQuotes] = useState([]);
  const [quotesLoading, setQuotesLoading] = useState(true);
  const [myBids, setMyBids] = useState([]);
  const [bidsLoading, setBidsLoading] = useState(true);
  const [bids, setBids] = useState({});
  const [deliveryTimes, setDeliveryTimes] = useState({});
  const [loadingMap, setLoadingMap] = useState({});
  const [bidStatusMap, setBidStatusMap] = useState({});
  const [didInfo, setDidInfo] = useState(null);

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

  // Fetch open FPO quotes
  const fetchFpoQuotes = useCallback(async () => {
    setQuotesLoading(true);
    try {
      const res = await axios.get("/api/retailer/quotes/fpo/open/", {
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
  }, [fetchFpoQuotes, fetchMyBids, fetchDid]);

  // 🔹 Bid input handlers
  const handleBidChange = (quoteId, value) => {
    setBids((prev) => ({ ...prev, [quoteId]: value }));
  };
  const handleDeliveryChange = (quoteId, value) => {
    setDeliveryTimes((prev) => ({ ...prev, [quoteId]: value }));
  };

  // 🔹 Submit bid
  const submitBid = async (quoteId) => {
    const amount = bids[quoteId];
    const days = deliveryTimes[quoteId];

    if (!amount || Number(amount) <= 0) {
      alert("⚠️ Please enter a valid bid amount in ₹.");
      return;
    }
    if (!days || Number(days) <= 0) {
      alert("⚠️ Please enter required delivery time in days.");
      return;
    }

    setLoadingMap((prev) => ({ ...prev, [quoteId]: true }));
    setBidStatusMap((prev) => ({ ...prev, [quoteId]: null }));

    try {
      await axios.post(
        `/api/retailer/quotes/fpo/${quoteId}/bids/`,
        {
          bid_amount: amount,
          delivery_time_days: days,
          quote: quoteId,
          retailer: retailerId,
        },
        { withCredentials: true }
      );
      setBidStatusMap((prev) => ({
        ...prev,
        [quoteId]: { type: "success", text: "✅ Bid placed successfully! FPO will review your offer." },
      }));
      setBids((prev) => ({ ...prev, [quoteId]: "" }));
      setDeliveryTimes((prev) => ({ ...prev, [quoteId]: "" }));
      fetchMyBids();
    } catch (err) {
      console.error("Error placing bid:", err.response?.data || err);
      const msg = err.response?.data?.error || err.response?.data?.detail || "Failed to place bid. Please try again.";
      setBidStatusMap((prev) => ({
        ...prev,
        [quoteId]: { type: "error", text: `❌ ${msg}` },
      }));
    } finally {
      setLoadingMap((prev) => ({ ...prev, [quoteId]: false }));
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

      <div className="max-w-6xl mx-auto w-full px-4 sm:px-6 py-6 sm:py-8 flex-1 space-y-6">

        {/* ── Welcome & Overview Banner ─────────────────────────────── */}
        <div className="bg-gradient-to-r from-purple-900 via-indigo-950 to-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
          <div className="absolute top-[-20%] right-[-10%] w-[40%] h-[140%] rounded-full bg-purple-500/10 blur-2xl pointer-events-none" />
          
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-700/80 border border-purple-500/40 text-purple-100">
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
                  Verified Retail Commercial Buyer
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                {didInfo?.name || "Retail Procurement Portal"}
              </h1>
              <p className="text-xs sm:text-sm text-purple-100/80 max-w-xl">
                Browse bulk agricultural lots aggregated by verified Farmer Producer Organizations (FPOs) and place commercial procurement bids.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => setActiveTab("quotes")}
                className="bg-purple-500 hover:bg-purple-400 text-slate-950 text-xs font-extrabold px-4 py-2.5 rounded-xl transition-all shadow-md shadow-purple-950/30 flex items-center gap-1.5 cursor-pointer"
              >
                <span>🏢</span>
                <span>Browse FPO Lots</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("bids")}
                className="bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-all border border-slate-700 shadow-md flex items-center gap-1.5 cursor-pointer"
              >
                <span>📑</span>
                <span>My Submitted Bids ({myBids.length})</span>
              </button>
            </div>
          </div>
        </div>

        {/* ── Summary Key Metrics Bar (Real Loaded Data Only) ─────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-2xs hover:border-purple-200 transition-all">
            <div className="flex justify-between items-start">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Available FPO Lots</span>
              <span className="text-lg">🏢</span>
            </div>
            <p className="text-2xl font-extrabold text-slate-900 mt-1 tracking-tight">
              {fpoQuotes.length}
            </p>
            <p className="text-[11px] text-purple-600 font-semibold mt-0.5">
              Open for Bidding
            </p>
          </div>

          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-2xs hover:border-blue-200 transition-all">
            <div className="flex justify-between items-start">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">My Placed Bids</span>
              <span className="text-lg">📑</span>
            </div>
            <p className="text-2xl font-extrabold text-slate-900 mt-1 tracking-tight">
              {myBids.length}
            </p>
            <p className="text-[11px] text-blue-600 font-semibold mt-0.5">
              Submitted to FPOs
            </p>
          </div>

          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-2xs hover:border-emerald-200 transition-all">
            <div className="flex justify-between items-start">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Accepted Deals</span>
              <span className="text-lg">🤝</span>
            </div>
            <p className="text-2xl font-extrabold text-slate-900 mt-1 tracking-tight">
              {acceptedBidsCount}
            </p>
            <p className="text-[11px] text-emerald-600 font-semibold mt-0.5">
              Approved by FPOs
            </p>
          </div>

          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-2xs hover:border-amber-200 transition-all">
            <div className="flex justify-between items-start">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Identity Status</span>
              <span className="text-lg">🛡️</span>
            </div>
            <p className="text-base font-extrabold text-slate-900 mt-2 truncate">
              {didInfo?.did ? "W3C Verified Retailer" : "Pending DID"}
            </p>
            <p className="text-[11px] text-amber-600 font-semibold mt-0.5">
              Role: Commercial Retailer
            </p>
          </div>
        </div>

        {/* ── DID & Trust Score Side-by-Side Grid ───────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <DidIdentityCard didInfo={didInfo} accentColor="purple" />
          <TrustReputationCard accentColor="purple" />
        </div>

        {/* ── Segmented Tab Navigation ──────────────────────────────── */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-1.5 shadow-2xs flex flex-wrap gap-1">
          <button
            type="button"
            className={`flex-1 min-w-[140px] py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === "quotes"
                ? "bg-purple-600 text-white shadow-sm"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
            }`}
            onClick={() => setActiveTab("quotes")}
          >
            <span>🏢</span>
            <span>Open FPO Quotes</span>
            {fpoQuotes.length > 0 && (
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                activeTab === "quotes" ? "bg-purple-700/80 text-white" : "bg-slate-100 text-slate-600"
              }`}>
                {fpoQuotes.length}
              </span>
            )}
          </button>

          <button
            type="button"
            className={`flex-1 min-w-[140px] py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === "bids"
                ? "bg-purple-600 text-white shadow-sm"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
            }`}
            onClick={() => setActiveTab("bids")}
          >
            <span>📑</span>
            <span>My Submitted Bids</span>
            {myBids.length > 0 && (
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                activeTab === "bids" ? "bg-purple-700/80 text-white" : "bg-slate-100 text-slate-600"
              }`}>
                {myBids.length}
              </span>
            )}
          </button>
        </div>

        {/* ── Open FPO Quotes Tab ────────────────────────────────────── */}
        {activeTab === "quotes" && (
          <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs">
            <div className="mb-5 pb-3 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-base font-extrabold text-slate-900">🏢 Open FPO Bulk Procurement Quotes</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Bulk lots offered by verified Farmer Producer Organizations (FPOs)
                </p>
              </div>
              {fpoQuotes.length > 0 && (
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
                  {fpoQuotes.length} Lots Available
                </span>
              )}
            </div>

            {quotesLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="bg-slate-50 border border-slate-200/60 rounded-2xl p-5 animate-pulse space-y-2">
                    <div className="h-4 bg-slate-200 rounded w-1/3"></div>
                    <div className="h-3 bg-slate-200 rounded w-2/3"></div>
                    <div className="h-8 bg-slate-200 rounded w-1/4 mt-2"></div>
                  </div>
                ))}
              </div>
            ) : fpoQuotes.length > 0 ? (
              <div className="space-y-4">
                {fpoQuotes.map((quote) => {
                  const currentBid = bids[quote.id] || "";
                  const totalEst = currentBid && quote.quantity ? (parseFloat(currentBid) * parseFloat(quote.quantity)).toFixed(2) : null;
                  const statusMsg = bidStatusMap[quote.id];
                  const isLoading = loadingMap[quote.id];

                  return (
                    <div
                      key={quote.id}
                      className="border border-slate-200/80 rounded-2xl p-5 hover:border-purple-300 hover:shadow-xs transition-all bg-white space-y-3"
                    >
                      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                        <div className="space-y-1.5 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-base font-extrabold text-slate-900">
                              {quote.product_name}
                            </span>
                            <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200">
                              {quote.category}
                            </span>
                            <span className="text-[11px] font-mono text-purple-600 font-semibold">
                              FPO #{quote.fpo}
                            </span>
                          </div>

                          {quote.description && (
                            <p className="text-xs text-slate-600">
                              {quote.description}
                            </p>
                          )}

                          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 pt-1">
                            <span className="bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-100 font-medium">
                              <strong className="text-slate-700">Lot Quantity:</strong> {quote.quantity} {quote.unit}
                            </span>
                            <span className="bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-100 font-medium">
                              <strong className="text-slate-700">Deadline:</strong> {quote.deadline}
                            </span>
                            {quote.price_per_unit && (
                              <span className="bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-100 font-medium">
                                <strong className="text-slate-700">Asking Price:</strong> ₹{quote.price_per_unit} / {quote.unit}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Bidding Controls */}
                        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 pt-2 lg:pt-0 shrink-0">
                          <div className="relative w-36">
                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                              Offer (₹/{quote.unit})
                            </label>
                            <input
                              type="number"
                              placeholder="₹ per unit"
                              value={bids[quote.id] || ""}
                              onChange={(e) => handleBidChange(quote.id, e.target.value)}
                              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none transition-all font-semibold"
                            />
                          </div>

                          <div className="relative w-28">
                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                              Delivery (Days)
                            </label>
                            <input
                              type="number"
                              placeholder="Days"
                              value={deliveryTimes[quote.id] || ""}
                              onChange={(e) => handleDeliveryChange(quote.id, e.target.value)}
                              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none transition-all font-semibold"
                            />
                          </div>

                          <div className="self-end">
                            <button
                              type="button"
                              onClick={() => submitBid(quote.id)}
                              disabled={isLoading}
                              className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-xl transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 h-[38px]"
                            >
                              <span>💰</span>
                              <span>{isLoading ? "Submitting…" : "Place Bid"}</span>
                            </button>
                          </div>
                        </div>
                      </div>

                      {totalEst && (
                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                          <span>Estimated Total Procurement Value:</span>
                          <span className="font-extrabold text-purple-700 font-mono text-sm">₹{totalEst}</span>
                        </div>
                      )}

                      {statusMsg && (
                        <div className={`p-2.5 rounded-xl text-xs font-medium ${
                          statusMsg.type === "success" ? "bg-emerald-50 border border-emerald-200 text-emerald-800" : "bg-rose-50 border border-rose-200 text-rose-800"
                        }`}>
                          {statusMsg.text}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-12 text-center bg-slate-50/50 rounded-2xl border border-slate-100">
                <span className="text-4xl block mb-2">🏢</span>
                <p className="text-sm font-bold text-slate-800">No Open FPO Quotes Available</p>
                <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                  FPOs have not published any open procurement lots at this time. Please check back shortly.
                </p>
              </div>
            )}
          </div>
        )}

        {/* ── My Submitted Bids Tab ──────────────────────────────────── */}
        {activeTab === "bids" && (
          <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs">
            <div className="mb-5 pb-3 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-base font-extrabold text-slate-900">📑 My Submitted Procurement Bids</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Track status of your commercial procurement bids submitted to FPOs
                </p>
              </div>
              {myBids.length > 0 && (
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                  {myBids.length} Submitted
                </span>
              )}
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {myBids.map((bid) => (
                  <div
                    key={bid.id}
                    className="border border-slate-200/80 rounded-2xl p-4 bg-white hover:border-slate-300 transition-all space-y-3 shadow-2xs"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-sm font-extrabold text-slate-900">
                          {bid.quote.product_name}
                        </p>
                        <span className="text-[11px] text-slate-500 font-medium">
                          {bid.quote.category}
                        </span>
                      </div>
                      <StatusBadge status={bid.status} />
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50/70 p-3 rounded-xl border border-slate-100">
                      <div>
                        <span className="text-[10px] text-slate-400 font-bold uppercase block">Bid Rate</span>
                        <span className="font-extrabold text-slate-800 font-mono">₹{bid.bid_amount} / {bid.quote.unit}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 font-bold uppercase block">Delivery Window</span>
                        <span className="font-semibold text-slate-700">{bid.delivery_time_days} days</span>
                      </div>
                      <div className="col-span-2 pt-1 border-t border-slate-200/60">
                        <span className="text-[10px] text-slate-400 font-bold uppercase block">Total Lot Quantity</span>
                        <span className="font-medium text-slate-700">{bid.quote.quantity} {bid.quote.unit}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-12 text-center bg-slate-50/50 rounded-2xl border border-slate-100">
                <span className="text-4xl block mb-2">📑</span>
                <p className="text-sm font-bold text-slate-800">No Bids Submitted Yet</p>
                <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                  Browse open FPO quotes in the marketplace tab and submit your commercial procurement offers.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
