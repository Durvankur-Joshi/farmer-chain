import React, { useState, useEffect } from "react";
import axios from "axios";
import Cookies from "js-cookie";
import { useNavigate } from "react-router-dom";
import QuoteForm from "../../components/farmer/QuoteForm";
import QuoteHistory from "../../components/farmer/QuoteHistory";
import QuoteBids from "../../components/farmer/QuoteBids";

export default function FarmerDashboard() {
  const navigate = useNavigate();
  const [history, setHistory] = useState([]);
  const [activePage, setActivePage] = useState("history");
  const [selectedQuote, setSelectedQuote] = useState(null);
  const [didInfo, setDidInfo] = useState(null);
  const [copyMsg, setCopyMsg] = useState("");

  // 🔹 Logout function
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

  // Fetch history
  const fetchHistory = async () => {
    try {
      const res = await axios.get("/api/farmer/quotes/", {
        withCredentials: true,
      });
      console.log("Fetched history:", res.data);
      
      setHistory(res.data);
    } catch (err) {
      console.error("Error fetching history:", err);
    }
  };

  // Fetch DID identity
  const fetchDid = async () => {
    try {
      const res = await axios.get("/api/did/me/", { withCredentials: true });
      setDidInfo(res.data);
    } catch (err) {
      console.error("Could not fetch DID:", err);
    }
  };

  // Copy DID to clipboard
  const copyDid = () => {
    if (!didInfo?.did) return;
    navigator.clipboard.writeText(didInfo.did).then(() => {
      setCopyMsg("✅ Copied!");
      setTimeout(() => setCopyMsg(""), 2000);
    });
  };

  useEffect(() => {
    fetchHistory();
    fetchDid();
  }, []);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Top Bar with Logout */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-green-700">🌾 Farmer Dashboard</h1>
        <button
          onClick={logout}
          className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
        >
          Logout
        </button>
      </div>

      {/* DID Identity Card */}
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

      {/* Farmer Quote Section */}
      <div className="bg-green-100 p-6 rounded-2xl shadow mb-6 text-center">
        <h2 className="text-2xl font-bold text-green-800">
          🌱 “The farmer is the backbone of our nation.”
        </h2>
        <p className="text-gray-700 mt-2">
          Nurturing the land, feeding the world. 🙌
        </p>
      </div>

      {/* Navigation Buttons */}
      {activePage === "history" && (
        <button
          onClick={() => setActivePage("newQuote")}
          className="mb-4 bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
        >
          ➕ New Quote
        </button>
      )}

      {/* Pages */}
      {activePage === "history" && (
        <QuoteHistory
          history={history}
          onViewBids={(quote) => {
            setSelectedQuote(quote);
            setActivePage("bids");
          }}
        />
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
    </div>
  );
}
