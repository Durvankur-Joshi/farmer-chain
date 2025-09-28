import React, { useEffect, useState } from "react";
import axios from "axios";

export default function FarmerQuotes() {
  const [quotes, setQuotes] = useState([]);
  const [bidAmount, setBidAmount] = useState({});

  useEffect(() => {
    axios
      .get("/api/fpo/quotes/farmer/open/")
      .then((res) => setQuotes(res.data || []))
      .catch((err) => console.error("Error fetching farmer quotes:", err));
  }, []);

  const handleBidSubmit = async (quoteId) => {
    try {
      await axios.post(`/api/fpo/quotes/farmer/${quoteId}/bids/`, {
        bid_amount: bidAmount[quoteId],
      });
      alert("✅ Bid placed successfully!");
    } catch (err) {
      console.error("Error placing bid:", err.response?.data || err.message);
    }
  };

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">👨‍🌾 Farmer Quotes</h2>
      {quotes.length === 0 ? (
        <p>No open farmer quotes available.</p>
      ) : (
        quotes.map((quote) => (
          <div
            key={quote.id}
            className="p-4 border rounded-lg shadow mb-3 bg-white"
          >
            <p>
              <strong>Product:</strong> {quote.product_name} ({quote.category})
            </p>
            <p>
              <strong>Quantity:</strong> {quote.quantity} {quote.unit}
            </p>
            <p>
              <strong>Deadline:</strong> {quote.deadline}
            </p>

            <input
              type="number"
              placeholder="Enter bid amount"
              value={bidAmount[quote.id] || ""}
              onChange={(e) =>
                setBidAmount({ ...bidAmount, [quote.id]: e.target.value })
              }
              className="border p-2 rounded mt-2 w-full"
            />
            <button
              onClick={() => handleBidSubmit(quote.id)}
              className="mt-2 bg-blue-600 text-white px-4 py-2 rounded"
            >
              Place Bid
            </button>
          </div>
        ))
      )}
    </div>
  );
}
