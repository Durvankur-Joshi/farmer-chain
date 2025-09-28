import React from "react";
import axios from "axios";

export default function QuoteBids({ quote, onBack, refreshHistory }) {
  // Accept Bid function
  const acceptBid = async (bidId) => {
    try {
      await axios.post(
        `/api/farmer/bids/fpo/${bidId}/accept/`,
        {},
        { withCredentials: true }
      );
      alert("✅ Bid accepted successfully!");
      if (refreshHistory) refreshHistory(); // refresh parent history if provided
    } catch (err) {
      console.error("Error accepting bid:", err);
      alert("❌ Failed to accept bid");
    }
  };

  return (
    <div className="bg-white p-6 rounded-2xl shadow">
      <button
        onClick={onBack}
        className="mb-4 bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
      >
        ⬅ Back
      </button>

      <h3 className="text-xl font-semibold mb-4">
        📦 Bids for {quote.product_name} ({quote.category})
      </h3>

      {quote.bids && quote.bids.length > 0 ? (
        <ul className="space-y-3">
          {quote.bids.map((bid, index) => (
            <li
              key={index}
              className="border p-3 rounded-lg flex justify-between items-center"
            >
              <div>
                <p>
                  💰 <strong>{bid.bid_amount}</strong> ETH
                </p>
                <p>⏳ Delivery Time: {bid.delivery_time_days} days</p>
                <p>🏢 FPO: {bid.fpo_name}</p>
                <p className="text-sm text-gray-500">
                  Submitted at: {new Date(bid.submitted_at).toLocaleString()}
                </p>
                <p>Status: {bid.status}</p>
              </div>

              {/* Accept button */}
              <button
                onClick={() => acceptBid(bid.id)}
                disabled={bid.status === "accepted"}
                className={`ml-4 px-4 py-2 rounded text-white ${
                  bid.status === "accepted"
                    ? "bg-green-400 cursor-not-allowed"
                    : "bg-green-600 hover:bg-green-700"
                }`}
              >
                {bid.status === "accepted" ? "✅ Accepted" : "Accept Bid"}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-gray-500">No bids for this quote yet.</p>
      )}
    </div>
  );
}
