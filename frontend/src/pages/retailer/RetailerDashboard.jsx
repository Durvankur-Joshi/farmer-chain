import React, { useState, useEffect } from "react";
import axios from "axios";
import Cookies from "js-cookie";
import { useNavigate } from "react-router-dom";

export default function RetailerDashboard() {
  const navigate = useNavigate();

  const [fpoQuotes, setFpoQuotes] = useState([]);
  const [myBids, setMyBids] = useState([]);
  const [bids, setBids] = useState({});
  const [deliveryTimes, setDeliveryTimes] = useState({});
  const [loading, setLoading] = useState(false);
  

  const retailerId = Cookies.get("retailer_id");

  // 🔹 Logout
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

  // 🔹 Fetch dashboard data
  useEffect(() => {
    const fetchFpoQuotes = async () => {
      try {
        const res = await axios.get("/api/retailer/quotes/fpo/open/", {
          withCredentials: true,
        });
        setFpoQuotes(res.data);
      } catch (err) {
        console.error("Error fetching FPO quotes:", err);
      }
    };

    
    const fetchMyBids = async () => {
      try {
        const res = await axios.get("/api/retailer/bids/my/", {
          withCredentials: true,
        });
        setMyBids(res.data);
      } catch (err) {
        console.error("Error fetching my bids:", err);
      }
    };

    fetchFpoQuotes();
    
    fetchMyBids();
  }, []);

  // 🔹 Bid input handlers
  const handleBidChange = (quoteId, value) => {
    setBids({ ...bids, [quoteId]: value });
  };
  const handleDeliveryChange = (quoteId, value) => {
    setDeliveryTimes({ ...deliveryTimes, [quoteId]: value });
  };

  // 🔹 Submit bid
  const submitBid = async (quoteId) => {
    if (!bids[quoteId]) {
      alert("⚠️ Please enter a bid amount.");
      return;
    }
    if (!deliveryTimes[quoteId]) {
      alert("⚠️ Please enter delivery time in days.");
      return;
    }

    setLoading(true);
    try {
      await axios.post(
        `/api/retailer/quotes/fpo/${quoteId}/bids/`,
        {
          bid_amount: bids[quoteId],
          delivery_time_days: deliveryTimes[quoteId],
          quote: quoteId,
          retailer: retailerId,
        },
        { withCredentials: true }
      );
      alert("✅ Bid placed successfully!");
      setBids({ ...bids, [quoteId]: "" });
      setDeliveryTimes({ ...deliveryTimes, [quoteId]: "" });
      // Refresh bids after placing
      const res = await axios.get("/api/retailer/bids/my/", {
        withCredentials: true,
      });
      setMyBids(res.data);
    } catch (err) {
      console.error("Error placing bid:", err.response?.data || err);
      alert("❌ Failed to place bid. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      {/* Top Bar */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-blue-700">
          🏪 Retailer Dashboard
        </h1>
        <button
          onClick={logout}
          className="bg-red-500 text-white px-4 py-2 rounded-lg shadow hover:bg-red-600"
        >
          Logout
        </button>
      </div>

      

      {/* Open FPO Quotes */}
      <div className="bg-white p-6 rounded-2xl shadow">
        <h3 className="text-xl font-semibold mb-4">🏢 Open FPO Quotes</h3>
        {fpoQuotes.length > 0 ? (
          <ul className="space-y-4">
            {fpoQuotes.map((quote) => (
              <li
                key={quote.id}
                className="border p-4 rounded-lg hover:shadow-lg transition"
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-lg font-semibold">
                      {quote.product_name}{" "}
                      <span className="text-gray-500">({quote.category})</span>
                    </p>
                    <p className="text-gray-600">{quote.description}</p>
                    <p className="text-sm">
                      Qty: {quote.quantity} {quote.unit}
                    </p>
                    <p className="text-sm text-gray-500">
                      Deadline: {quote.deadline}
                    </p>
                    <p className="text-sm text-blue-600">FPO ID: {quote.fpo}</p>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3 mt-3 sm:mt-0">
                    <input
                      type="number"
                      placeholder="Bid amount"
                      value={bids[quote.id] || ""}
                      onChange={(e) =>
                        handleBidChange(quote.id, e.target.value)
                      }
                      className="border p-2 rounded-lg flex-1 focus:ring-2 focus:ring-blue-400 outline-none"
                    />
                    <input
                      type="number"
                      placeholder="Delivery (days)"
                      value={deliveryTimes[quote.id] || ""}
                      onChange={(e) =>
                        handleDeliveryChange(quote.id, e.target.value)
                      }
                      className="border p-2 rounded-lg w-32 focus:ring-2 focus:ring-green-400 outline-none"
                    />
                    <button
                      onClick={() => submitBid(quote.id)}
                      disabled={loading}
                      className={`px-4 py-2 rounded-lg text-white shadow ${
                        loading
                          ? "bg-gray-400 cursor-not-allowed"
                          : "bg-blue-600 hover:bg-blue-700"
                      }`}
                    >
                      {loading ? "Submitting..." : "💰 Place Bid"}
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-gray-500">No open FPO quotes available.</p>
        )}
      </div>

      {/* My Bids Section */}
      <div className="bg-white p-6 rounded-2xl shadow">
        <h3 className="text-xl font-semibold mb-4">📑 My Placed Bids</h3>
        {myBids.length > 0 ? (
          <ul className="space-y-4">
            {myBids.map((bid) => (
              <li
                key={bid.id}
                className="border p-4 rounded-lg hover:shadow-lg transition"
              >
                <p className="text-lg font-semibold">
                  {bid.quote.product_name}{" "}
                  <span className="text-gray-500">({bid.quote.category})</span>
                </p>
                <p className="text-gray-600">{bid.quote.description}</p>
                <p className="text-sm">
                  Qty: {bid.quote.quantity} {bid.quote.unit}
                </p>
                <p className="text-sm">Bid Amount: ₹{bid.bid_amount}</p>
                <p className="text-sm">Delivery: {bid.delivery_time_days} days</p>
                <p
                  className={`text-sm font-semibold ${
                    bid.status === "accepted"
                      ? "text-green-600"
                      : bid.status === "rejected"
                      ? "text-red-600"
                      : "text-yellow-600"
                  }`}
                >
                  Status: {bid.status}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-gray-500">You haven't placed any bids yet.</p>
        )}
      </div>
    </div>
  );
}
