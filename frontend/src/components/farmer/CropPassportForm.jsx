/**
 * CropPassportForm.jsx — Phase 2.2
 * Form for creating a new Crop Passport.
 * farmer_id is NEVER sent — the backend derives it from the JWT cookie.
 */
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

    if (!form.crop_name.trim())         return setError("Crop name is required.");
    if (!form.crop_category)            return setError("Category is required.");
    if (!form.quantity || Number(form.quantity) <= 0)
                                        return setError("Quantity must be greater than 0.");
    if (!form.cultivation_date)         return setError("Cultivation date is required.");
    if (!form.harvest_date)             return setError("Harvest date is required.");
    if (form.cultivation_date > form.harvest_date)
                                        return setError("Cultivation date cannot be after harvest date.");

    setSubmitting(true);
    try {
      await axios.post("/api/farmer/crops/", form, { withCredentials: true });
      onSuccess && onSuccess();
    } catch (err) {
      const msg =
        err.response?.data?.detail ||
        JSON.stringify(err.response?.data) ||
        "Failed to create Crop Passport.";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow p-6 border border-green-100">
      <h2 className="text-lg font-bold text-green-800 mb-4">🌾 Create Crop Passport</h2>

      {error && (
        <div className="bg-red-50 border border-red-300 text-red-700 rounded p-3 mb-4 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Crop Name *</label>
            <input
              name="crop_name"
              value={form.crop_name}
              onChange={handleChange}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
              placeholder="e.g. Wheat"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
            <select
              name="crop_category"
              value={form.crop_category}
              onChange={handleChange}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
            >
              <option value="">Select category</option>
              {CATEGORY_OPTIONS.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
          <textarea
            name="description"
            value={form.description}
            onChange={handleChange}
            rows={2}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
            placeholder="Optional notes about this crop batch"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Quantity *</label>
            <input
              name="quantity"
              type="number"
              min="0.01"
              step="0.01"
              value={form.quantity}
              onChange={handleChange}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
              placeholder="e.g. 500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Unit *</label>
            <select
              name="unit"
              value={form.unit}
              onChange={handleChange}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
            >
              {UNIT_OPTIONS.map((u) => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Cultivation Date *</label>
            <input
              name="cultivation_date"
              type="date"
              value={form.cultivation_date}
              onChange={handleChange}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Harvest Date *</label>
            <input
              name="harvest_date"
              type="date"
              value={form.harvest_date}
              onChange={handleChange}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
            />
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={submitting}
            className="bg-green-600 text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-green-700 disabled:opacity-50"
          >
            {submitting ? "Creating…" : "✅ Create Passport"}
          </button>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="bg-gray-200 text-gray-700 px-5 py-2 rounded-lg text-sm hover:bg-gray-300"
            >
              Cancel
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
