import React, { useState } from "react";
import axios from "axios";

export default function BidForm({ quote, onClose, onSuccess }) {
  const [bidAmount, setBidAmount] = useState("");
  const [deliveryDays, setDeliveryDays] = useState("");

  const submitBid = async (e) => {
    e.preventDefault();
    try {
      await axios.post(
        `/api/fpo/quotes/farmer/${quote.id}/bids/`,
        { bid_amount: bidAmount, delivery_time_days: deliveryDays },
        { withCredentials: true }
      );
      alert("✅ Bid submitted successfully!");
      onSuccess();
      onClose();
    } catch (err) {
      console.error("Error submitting bid:", err);
      alert("❌ Failed to submit bid");
    }
  };

  return (
    <div className="border p-4 rounded-xl shadow bg-gray-50">
      <h3 className="text-lg font-bold mb-3">Place Bid on {quote.product_name}</h3>
      <form onSubmit={submitBid} className="space-y-3">
        <input
          type="number"
          step="0.01"
          placeholder="Bid Amount (ETH)"
          value={bidAmount}
          onChange={(e) => setBidAmount(e.target.value)}
          className="border p-2 w-full rounded"
          required
        />
        <input
          type="number"
          placeholder="Delivery Time (days)"
          value={deliveryDays}
          onChange={(e) => setDeliveryDays(e.target.value)}
          className="border p-2 w-full rounded"
          required
        />
        <div className="flex space-x-2">
          <button
            type="submit"
            className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
          >
            Submit Bid
          </button>
          <button
            type="button"
            onClick={onClose}
            className="bg-gray-400 text-white px-4 py-2 rounded hover:bg-gray-500"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
