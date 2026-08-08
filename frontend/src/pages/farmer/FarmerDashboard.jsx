import React, { useState, useEffect } from "react";
import axios from "axios";
import Cookies from "js-cookie";
import { useNavigate } from "react-router-dom";
import QuoteForm from "../../components/farmer/QuoteForm";
import QuoteHistory from "../../components/farmer/QuoteHistory";
import QuoteBids from "../../components/farmer/QuoteBids";
import CropPassportForm from "../../components/farmer/CropPassportForm";
import CropPassportCard from "../../components/farmer/CropPassportCard";

// activePage values: "history" | "newQuote" | "bids" | "crops" | "newCrop"

export default function FarmerDashboard() {
  const navigate = useNavigate();
  const [history, setHistory] = useState([]);
  const [activePage, setActivePage] = useState("history");
  const [selectedQuote, setSelectedQuote] = useState(null);
  const [didInfo, setDidInfo] = useState(null);
  const [copyMsg, setCopyMsg] = useState("");
  const [crops, setCrops] = useState([]);
  const [cropsLoading, setCropsLoading] = useState(false);

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
  const fetchHistory = async () => {
    try {
      const res = await axios.get("/api/farmer/quotes/", { withCredentials: true });
      setHistory(res.data);
    } catch (err) {
      console.error("Error fetching history:", err);
    }
  };

  // ── DID identity ─────────────────────────────────────────────────
  const fetchDid = async () => {
    try {
      const res = await axios.get("/api/did/me/", { withCredentials: true });
      setDidInfo(res.data);
    } catch (err) {
      console.error("Could not fetch DID:", err);
    }
  };

  const copyDid = () => {
    if (!didInfo?.did) return;
    navigator.clipboard.writeText(didInfo.did).then(() => {
      setCopyMsg("✅ Copied!");
      setTimeout(() => setCopyMsg(""), 2000);
    });
  };

  // ── Crop Passports ───────────────────────────────────────────────
  const fetchCrops = async () => {
    setCropsLoading(true);
    try {
      const res = await axios.get("/api/farmer/crops/", { withCredentials: true });
      setCrops(res.data);
    } catch (err) {
      console.error("Error fetching crop passports:", err);
    } finally {
      setCropsLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
    fetchDid();
    fetchCrops();
  }, []);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* ── Top Bar ─────────────────────────────────────────────── */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-green-700">🌾 Farmer Dashboard</h1>
        <button
          onClick={logout}
          className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
        >
          Logout
        </button>
      </div>

      {/* ── DID Identity Card ────────────────────────────────────── */}
      {didInfo && (
        <div className="bg-white border border-green-200 rounded-2xl shadow p-5 mb-6">
          <h3 className="text-sm font-semibold text-green-700 uppercase tracking-widest mb-3">
            🔐 Decentralized Identity
          </h3>
          <div className="space-y-1 text-sm text-gray-700">
            <p><span className="font-medium text-gray-500">Role:</span> {didInfo.role}</p>
            <p className="break-all"><span className="font-medium text-gray-500">DID:</span> {didInfo.did}</p>
            <p className="break-all"><span className="font-medium text-gray-500">Wallet:</span> {didInfo.wallet_address}</p>
          </div>
          <div className="mt-3 flex items-center gap-3">
            <button
              onClick={copyDid}
              className="text-xs bg-green-600 text-white px-3 py-1.5 rounded hover:bg-green-700"
            >
              📋 Copy DID
            </button>
            {copyMsg && <span className="text-xs text-green-600 font-semibold">{copyMsg}</span>}
          </div>
        </div>
      )}

      {/* ── Banner ──────────────────────────────────────────────── */}
      <div className="bg-green-100 p-6 rounded-2xl shadow mb-6 text-center">
        <h2 className="text-2xl font-bold text-green-800">
          🌱 "The farmer is the backbone of our nation."
        </h2>
        <p className="text-gray-700 mt-2">Nurturing the land, feeding the world. 🙌</p>
      </div>

      {/* ── Navigation ──────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2 mb-6">
        <button
          onClick={() => setActivePage("history")}
          className={`px-4 py-2 rounded-lg text-sm font-semibold ${
            activePage === "history" ? "bg-green-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
          }`}
        >
          📜 My Quotes
        </button>
        <button
          onClick={() => setActivePage("crops")}
          className={`px-4 py-2 rounded-lg text-sm font-semibold ${
            activePage === "crops" || activePage === "newCrop"
              ? "bg-purple-600 text-white"
              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
          }`}
        >
          🌾 Crop Passports
        </button>
      </div>

      {/* ── Quotes Section ───────────────────────────────────────── */}
      {activePage === "history" && (
        <>
          <button
            onClick={() => setActivePage("newQuote")}
            className="mb-4 bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
          >
            ➕ New Quote
          </button>
          <QuoteHistory
            history={history}
            onViewBids={(quote) => {
              setSelectedQuote(quote);
              setActivePage("bids");
            }}
          />
        </>
      )}

      {activePage === "newQuote" && (
        <QuoteForm
          onSuccess={() => {
            fetchHistory();
            setActivePage("history");
          }}
        />
      )}

      {activePage === "bids" && selectedQuote && (
        <QuoteBids
          quote={selectedQuote}
          onBack={() => setActivePage("history")}
        />
      )}

      {/* ── Crop Passport Section ────────────────────────────────── */}
      {(activePage === "crops" || activePage === "newCrop") && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-purple-800">🌾 My Crop Passports</h2>
            {activePage === "crops" && (
              <button
                onClick={() => setActivePage("newCrop")}
                className="bg-purple-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-purple-700"
              >
                ➕ New Crop Passport
              </button>
            )}
            {activePage === "newCrop" && (
              <button
                onClick={() => setActivePage("crops")}
                className="text-sm text-gray-500 hover:underline"
              >
                ← Back to Crop Passports
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
                <p className="text-gray-500 text-sm">Loading…</p>
              ) : crops.length === 0 ? (
                <div className="bg-purple-50 border border-purple-200 rounded-2xl p-8 text-center">
                  <p className="text-purple-700 font-medium">No Crop Passports yet.</p>
                  <p className="text-gray-500 text-sm mt-1">
                    Create your first crop passport and mint it as an NFT on Ethereum.
                  </p>
                </div>
              ) : (
                crops.map((crop) => (
                  <CropPassportCard
                    key={crop.id}
                    crop={crop}
                    onMintSuccess={fetchCrops}
                  />
                ))
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
