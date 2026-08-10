import React, { useState } from "react";
import axios from "axios";

export default function QuoteForm({ onSuccess }) {
  const [formData, setFormData] = useState({
    product_name: "",
    category: "",
    description: "",
    quantity: "",
    unit: "",
    deadline: "",
  });

  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setErrors({ ...errors, [e.target.name]: "" });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await axios.post("/api/farmer/quotes/", formData, {
        withCredentials: true,
      });
      alert("✅ Supply quote published successfully!");
      setFormData({
        product_name: "",
        category: "",
        description: "",
        quantity: "",
        unit: "",
        deadline: "",
      });
      onSuccess();
    } catch (err) {
      if (err.response?.data) {
        setErrors(err.response.data);
      } else {
        console.error("Error posting product:", err);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 max-w-2xl"
    >
      {/* Product Name */}
      <div>
        <label className="block text-xs font-semibold text-slate-700 mb-1">
          Product / Crop Name
        </label>
        <input
          type="text"
          name="product_name"
          placeholder="e.g. Organic Sharbati Wheat"
          value={formData.product_name}
          onChange={handleChange}
          className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-all"
          required
        />
        {errors.product_name && (
          <p className="text-rose-500 text-xs mt-1">{errors.product_name[0]}</p>
        )}
      </div>

      {/* Category & Unit */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Category
          </label>
          <select
            name="category"
            value={formData.category}
            onChange={handleChange}
            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-all cursor-pointer"
            required
          >
            <option value="">Select Category</option>
            <option value="Grains">Grains</option>
            <option value="Vegetables">Vegetables</option>
            <option value="Fruits">Fruits</option>
            <option value="Pulses">Pulses / Legumes</option>
            <option value="Oilseeds">Oilseeds</option>
            <option value="Dairy">Dairy</option>
          </select>
          {errors.category && (
            <p className="text-rose-500 text-xs mt-1">{errors.category[0]}</p>
          )}
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Measurement Unit
          </label>
          <select
            name="unit"
            value={formData.unit}
            onChange={handleChange}
            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-all cursor-pointer"
            required
          >
            <option value="">Select Unit</option>
            <option value="kg">Kilogram (kg)</option>
            <option value="quintal">Quintal (100 kg)</option>
            <option value="ton">Metric Ton</option>
            <option value="litre">Litre</option>
          </select>
          {errors.unit && (
            <p className="text-rose-500 text-xs mt-1">{errors.unit[0]}</p>
          )}
        </div>
      </div>

      {/* Quantity & Deadline */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Total Quantity Available
          </label>
          <input
            type="number"
            name="quantity"
            placeholder="e.g. 500"
            value={formData.quantity}
            onChange={handleChange}
            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-all"
            required
          />
          {errors.quantity && (
            <p className="text-rose-500 text-xs mt-1">{errors.quantity[0]}</p>
          )}
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Bidding Deadline
          </label>
          <input
            type="date"
            name="deadline"
            value={formData.deadline}
            onChange={handleChange}
            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-all"
            required
          />
          {errors.deadline && (
            <p className="text-rose-500 text-xs mt-1">{errors.deadline[0]}</p>
          )}
        </div>
      </div>

      {/* Description */}
      <div>
        <label className="block text-xs font-semibold text-slate-700 mb-1">
          Detailed Description & Harvest Notes
        </label>
        <textarea
          name="description"
          placeholder="Describe quality, moisture content, packaging specifications, and delivery readiness…"
          value={formData.description}
          onChange={handleChange}
          rows={3}
          className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-all resize-none"
          required
        />
        {errors.description && (
          <p className="text-rose-500 text-xs mt-1">{errors.description[0]}</p>
        )}
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 px-4 rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
      >
        <span>{loading ? "Publishing Quote…" : "✅ Publish Supply Quote"}</span>
      </button>
    </form>
  );
}
