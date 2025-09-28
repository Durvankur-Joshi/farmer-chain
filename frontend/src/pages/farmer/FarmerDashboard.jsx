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
  const [activePage, setActivePage] = useState("history"); // "history" | "newQuote" | "bids"
  const [selectedQuote, setSelectedQuote] = useState(null);

  // 🔹 Logout function
  const logout = async () => {
    try {
      await axios.post("/api/logout/", {}, { withCredentials: true });
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

  useEffect(() => {
    fetchHistory();
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
