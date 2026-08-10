import React, { useState } from "react";
import axios from "axios";

const UNIT_OPTIONS = ["kg", "quintal", "ton", "litre", "piece", "dozen"];
const CATEGORY_OPTIONS = [
  "Cereal", "Pulse", "Oilseed", "Vegetable", "Fruit",
  "Spice", "Fibre", "Sugar", "Plantation", "Other",
];

export default function CropPassportForm({ onSuccess, onCancel }) {
  const [form, setForm] = useState({
    crop_name: "",
    crop_category: "",
    description: "",
    quantity: "",
    unit: "kg",
    cultivation_date: "",
    harvest_date: "",
  });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!form.crop_name.trim()) return setError("Crop name is required.");
    if (!form.crop_category) return setError("Please select a crop category.");
    if (!form.quantity || Number(form.quantity) <= 0)
      return setError("Quantity must be a positive number.");
    if (!form.cultivation_date) return setError("Cultivation start date is required.");
    if (!form.harvest_date) return setError("Harvest completion date is required.");
    if (form.cultivation_date > form.harvest_date)
      return setError("Cultivation date cannot be after harvest date.");

    setSubmitting(true);
    try {
      await axios.post("/api/farmer/crops/", form, { withCredentials: true });
      onSuccess && onSuccess();
    } catch (err) {
      const msg =
        err.response?.data?.detail ||
        err.response?.data?.error ||
        JSON.stringify(err.response?.data) ||
        "Failed to register digital crop passport.";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-5 max-w-2xl">
      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl p-4 text-xs font-medium flex items-center gap-2">
          <span>⚠️</span>
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Section 1: Crop Lot Information */}
        <div className="bg-slate-50/70 border border-slate-200/80 rounded-2xl p-4 sm:p-5 space-y-3.5">
          <div className="flex items-center gap-2 border-b border-slate-200/60 pb-2">
            <span className="text-sm">🌾</span>
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              1. Crop Lot Information
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Crop / Lot Name *
              </label>
              <input
                name="crop_name"
                value={form.crop_name}
                onChange={handleChange}
                className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none transition-all font-medium"
                placeholder="e.g. Organic Sharbati Wheat (Grade A)"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Category *
              </label>
              <select
                name="crop_category"
                value={form.crop_category}
                onChange={handleChange}
                className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none transition-all cursor-pointer font-medium"
                required
              >
                <option value="">Select Category</option>
                {CATEGORY_OPTIONS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Description & Agronomic Notes
            </label>
            <textarea
              name="description"
              value={form.description}
              onChange={handleChange}
              rows={2}
              className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none transition-all resize-none font-medium"
              placeholder="Seed variety, pesticide-free practices, organic farm details…"
            />
          </div>
        </div>

        {/* Section 2: Batch Quantity & Unit */}
        <div className="bg-slate-50/70 border border-slate-200/80 rounded-2xl p-4 sm:p-5 space-y-3.5">
          <div className="flex items-center gap-2 border-b border-slate-200/60 pb-2">
            <span className="text-sm">⚖️</span>
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              2. Yield & Batch Specifications
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Lot Quantity *
              </label>
              <input
                name="quantity"
                type="number"
                min="0.01"
                step="0.01"
                value={form.quantity}
                onChange={handleChange}
                className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none transition-all font-mono font-semibold"
                placeholder="e.g. 500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Unit of Measure *
              </label>
              <select
                name="unit"
                value={form.unit}
                onChange={handleChange}
                className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none transition-all cursor-pointer font-medium"
                required
              >
                {UNIT_OPTIONS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Section 3: Cultivation & Harvest Timeline */}
        <div className="bg-slate-50/70 border border-slate-200/80 rounded-2xl p-4 sm:p-5 space-y-3.5">
          <div className="flex items-center gap-2 border-b border-slate-200/60 pb-2">
            <span className="text-sm">📅</span>
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              3. Cultivation & Harvest Timeline
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Cultivation Start Date *
              </label>
              <input
                name="cultivation_date"
                type="date"
                value={form.cultivation_date}
                onChange={handleChange}
                className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none transition-all font-medium"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Harvest Completion Date *
              </label>
              <input
                name="harvest_date"
                type="date"
                value={form.harvest_date}
                onChange={handleChange}
                className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none transition-all font-medium"
                required
              />
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={submitting}
            className="bg-purple-600 hover:bg-purple-500 text-white px-6 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md shadow-purple-900/20 disabled:opacity-50 flex items-center gap-2 cursor-pointer"
          >
            <span>🌾</span>
            <span>{submitting ? "Registering Passport…" : "Register Digital Crop Passport"}</span>
          </button>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer"
            >
              Cancel
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
