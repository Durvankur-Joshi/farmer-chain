import React, { useState, useEffect } from "react";
import axios from "axios";
import Cookies from "js-cookie";
import { useNavigate } from "react-router-dom";
import FarmerQuotes from "../../components/fpo/FarmerQuotes";
import RetailerQuotes from "../../components/fpo/RetailerQuotes";

export default function FpoDashboard() {
  const [activeTab, setActiveTab] = useState("farmer");
  const navigate = useNavigate();
  const [didInfo, setDidInfo] = useState(null);
  const [copyMsg, setCopyMsg] = useState("");

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
    fetchDid();
  }, []);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Top Bar */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-blue-700">🏢 FPO Dashboard</h1>
        <button
          onClick={logout}
          className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
        >
          Logout
        </button>
      </div>

      {/* DID Identity Card */}
      {didInfo && (
        <div className="bg-white border border-blue-200 rounded-2xl shadow p-5 mb-6">
          <h3 className="text-sm font-semibold text-blue-700 uppercase tracking-widest mb-3">
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
              className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700"
            >
              📋 Copy DID
            </button>
            {copyMsg && <span className="text-xs text-blue-600 font-semibold">{copyMsg}</span>}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex space-x-4 mb-6">
        <button
          className={`px-4 py-2 rounded ${
            activeTab === "farmer" ? "bg-blue-600 text-white" : "bg-gray-200"
          }`}
          onClick={() => setActiveTab("farmer")}
        >
          Farmer Quotes
        </button>
        <button
          className={`px-4 py-2 rounded ${
            activeTab === "retailer" ? "bg-blue-600 text-white" : "bg-gray-200"
          }`}
          onClick={() => setActiveTab("retailer")}
        >
          Retailer Quotes
        </button>
      </div>

      {/* Content */}
      {activeTab === "farmer" ? <FarmerQuotes /> : <RetailerQuotes />}
    </div>
  );
}
