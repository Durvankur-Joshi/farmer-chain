import React, { useState, useEffect } from "react";
import axios from "axios";

export default function RetailerQuotes() {
  const [quotes, setQuotes] = useState([]);
  const [form, setForm] = useState({
    product_name: "",
    category: "",
    quantity: "",
    unit: "",
    price_per_unit: "",
    deadline: "",
    description: "",
  });
  const [expandedQuote, setExpandedQuote] = useState(null); // to toggle bids view

  const fetchRetailerQuotes = async () => {
    try {
      const res = await axios.get("/api/fpo/quotes/", {
        withCredentials: true,
      });
      console.log("Fetched retailer quotes:", res.data);
      setQuotes(res.data);
    } catch (err) {
      console.error("Error fetching retailer quotes:", err);
    }
  };

  const acceptBid = async (bidId) => {
    try {
      await axios.post(
        `/api/fpo/bids/retailer/${bidId}/accept/`,
        {},
        { withCredentials: true }
      );
      alert("✅ Bid accepted!");
      fetchRetailerQuotes(); // refresh quotes so accepted_bid + bids update
    } catch (err) {
      console.error("Error accepting bid:", err);
      alert("❌ Failed to accept bid");
    }
  };

  useEffect(() => {
    fetchRetailerQuotes();
  }, []);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const submitQuote = async (e) => {
    e.preventDefault();
    try {
      await axios.post("/api/fpo/quotes/", form, { withCredentials: true });
      alert("✅ Quote submitted to retailers!");
      fetchRetailerQuotes();
      setForm({
        product_name: "",
        category: "",
        quantity: "",
        unit: "",
        price_per_unit: "",
        deadline: "",
        description: "",
      });
    } catch (err) {
      console.error("Error submitting retailer quote:", err);
      alert("❌ Failed to submit quote");
    }
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow">
      <h2 className="text-xl font-bold mb-4">🛒 Retailer Quotes</h2>

      {/* Form */}
      <form onSubmit={submitQuote} className="space-y-3 mb-6">
        <input
          name="product_name"
          placeholder="Product Name"
          value={form.product_name}
          onChange={handleChange}
          className="border p-2 w-full rounded"
          required
        />
        <input
          name="category"
          placeholder="Category"
          value={form.category}
          onChange={handleChange}
          className="border p-2 w-full rounded"
          required
        />
        <input
          name="quantity"
          type="number"
          placeholder="Quantity"
          value={form.quantity}
          onChange={handleChange}
          className="border p-2 w-full rounded"
          required
        />
        <input
          name="unit"
          placeholder="Unit (kg, ton, etc.)"
          value={form.unit}
          onChange={handleChange}
          className="border p-2 w-full rounded"
          required
        />
        <input
          name="price_per_unit"
          type="number"
          placeholder="Price per Unit"
          value={form.price_per_unit}
          onChange={handleChange}
          className="border p-2 w-full rounded"
          required
        />
        <input
          name="deadline"
          type="date"
          value={form.deadline}
          onChange={handleChange}
          className="border p-2 w-full rounded"
          required
        />
        <textarea
          name="description"
          placeholder="Description"
          value={form.description}
          onChange={handleChange}
          className="border p-2 w-full rounded"
        />
        <button
          type="submit"
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          Submit Quote
        </button>
      </form>

      {/* Quotes */}
      {quotes.length > 0 ? (
        <ul className="space-y-3">
          {quotes.map((q) => (
            <li key={q.id} className="border p-3 rounded-lg">
              <p>
                <strong>{q.product_name}</strong> ({q.category})
              </p>
              <p>
                Qty: {q.quantity} {q.unit}
              </p>
              <p>
                Price: {q.price_per_unit} per {q.unit}
              </p>
              <p>Deadline: {q.deadline}</p>
              <p className="text-sm text-gray-500">{q.description}</p>

              {/* Toggle bids */}
              <button
                onClick={() =>
                  setExpandedQuote(expandedQuote === q.id ? null : q.id)
                }
                className="mt-2 text-sm bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700"
              >
                {expandedQuote === q.id ? "Hide Bids" : "Show Bids"}
              </button>

              {/* Bids list */}
              {expandedQuote === q.id && (
                <div className="mt-3 border-t pt-3">
                  {q.bids.length > 0 ? (
                    <ul className="space-y-2">
                      {q.bids.map((b) => (
                        <li
                          key={b.id}
                          className="border p-2 rounded flex justify-between items-center"
                        >
                          <div>
                            <p>
                              <strong>{b.retailer_name}</strong> ({b.retailer_email})
                            </p>
                            <p>
                              Offered: {b.price} per {b.unit} | Qty: {b.quantity}
                            </p>
                            <p className="text-sm text-gray-500">{b.note}</p>
                          </div>
                          {q.accepted_bid === b.id ? (
                            <p className="text-green-600 font-medium">✅ Accepted</p>
                          ) : (
                            <button
                              onClick={() => acceptBid(b.id)}
                              className="text-sm bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700"
                            >
                              Accept Bid
                            </button>
                          )}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-gray-500">No bids yet for this quote.</p>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-gray-500">No retailer quotes submitted yet.</p>
      )}
    </div>
  );
}
