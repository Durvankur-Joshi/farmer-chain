import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { useRefresh, useRefreshSubscription } from "../../context/useRefresh";
import { formatSettlementBreakdown } from "../../utils/pricing";

export default function QuoteForm({ onSuccess, onNavigateToPassports }) {
  const { refresh } = useRefresh();
  const [passports, setPassports] = useState([]);
  const [passportsLoading, setPassportsLoading] = useState(true);
  const [selectedPassportId, setSelectedPassportId] = useState("");
  const [selectedPassport, setSelectedPassport] = useState(null);

  const [formData, setFormData] = useState({
    price_per_unit: "",
    deadline: "",
    description: "",
  });

  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const fetchPassports = useCallback(async () => {
    setPassportsLoading(true);
    try {
      const res = await axios.get("/api/farmer/crops/", { withCredentials: true });
      const list = res.data || [];
      setPassports(list);
      if (list.length === 1) {
        setSelectedPassportId(String(list[0].id));
        setSelectedPassport(list[0]);
      }
    } catch (err) {
      console.error("Error fetching farmer passports:", err);
    } finally {
      setPassportsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPassports();
  }, [fetchPassports]);

  useRefreshSubscription(["farmer", "inventory"], fetchPassports);

  const handlePassportSelect = (e) => {
    const passportId = e.target.value;
    setSelectedPassportId(passportId);
    setErrors({});
    setFeedback(null);

    const found = passports.find((p) => String(p.id) === String(passportId));
    setSelectedPassport(found || null);
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setErrors({ ...errors, [e.target.name]: "" });
    setFeedback(null);
  };

  const settlement = selectedPassport
    ? formatSettlementBreakdown(formData.price_per_unit, selectedPassport.quantity, selectedPassport.unit)
    : null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setFeedback(null);

    if (!selectedPassportId || !selectedPassport) {
      setFeedback({
        type: "error",
        text: "❌ Please select a valid Crop Record for this quote.",
      });
      setLoading(false);
      return;
    }

    const p = parseFloat(formData.price_per_unit);
    if (isNaN(p) || p <= 0) {
      setFeedback({
        type: "error",
        text: "❌ Asking price must be a positive number greater than 0.",
      });
      setLoading(false);
      return;
    }

    if (!formData.deadline) {
      setFeedback({
        type: "error",
        text: "❌ Please specify a bidding deadline in the future.",
      });
      setLoading(false);
      return;
    }

    const payload = {
      crop_passport: selectedPassport.id,
      product_name: selectedPassport.crop_name,
      quantity: selectedPassport.quantity,
      unit: selectedPassport.unit,
      price_per_unit: formData.price_per_unit,
      deadline: formData.deadline,
    };

    try {
      await axios.post("/api/farmer/quotes/", payload, {
        withCredentials: true,
      });

      setFeedback({
        type: "success",
        text: "✅ Harvest Quote published to marketplace! FPOs can now place bids.",
      });

      setFormData({
        price_per_unit: "",
        deadline: "",
        description: "",
      });

      setSelectedPassportId("");
      setSelectedPassport(null);
      refresh(["quotes", "farmer"]);
      if (onSuccess) onSuccess();
    } catch (err) {
      console.error("Quote publish error:", err);
      if (err.response?.data) {
        setErrors(err.response.data);
        const firstErr = Object.values(err.response.data)[0];
        setFeedback({
          type: "error",
          text: `❌ ${Array.isArray(firstErr) ? firstErr[0] : firstErr}`,
        });
      } else {
        setFeedback({
          type: "error",
          text: "❌ Failed to publish quote. Please check your network and try again.",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  if (passportsLoading) {
    return (
      <div className="py-12 text-center text-xs text-slate-400 animate-pulse space-y-2">
        <div className="h-6 w-48 bg-slate-200 rounded mx-auto"></div>
        <p>Loading your verified Crop Records…</p>
      </div>
    );
  }

  if (!passportsLoading && passports.length === 0) {
    return (
      <div className="py-10 px-6 text-center bg-amber-50/60 rounded-2xl border border-amber-200/80 space-y-4">
        <span className="text-4xl block">🌾</span>
        <div className="space-y-1">
          <h3 className="text-sm font-extrabold text-amber-900">
            No Crop Records Available
          </h3>
          <p className="text-xs text-amber-700 max-w-md mx-auto">
            Create and complete a Crop Record before creating a quote. Quotes require a verified record to guarantee provenance and crop lot specifications.
          </p>
        </div>
        {onNavigateToPassports && (
          <button
            type="button"
            onClick={onNavigateToPassports}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition-all shadow-xs inline-flex items-center gap-1.5 cursor-pointer"
          >
            <span>➕</span>
            <span>Create Crop Record</span>
          </button>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 max-w-2xl">
      {feedback && (
        <div
          className={`p-3.5 rounded-xl border text-xs font-semibold flex items-center gap-2 animate-fade-in ${
            feedback.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : "bg-rose-50 border-rose-200 text-rose-800"
          }`}
        >
          <span>{feedback.text}</span>
        </div>
      )}

      {/* ── 1. Select Crop Passport ─────────────────────────────────── */}
      <div className="space-y-2">
        <label className="block text-xs font-bold text-slate-700">
          🌾 Select Source Crop Record *
        </label>
        <select
          value={selectedPassportId}
          onChange={handlePassportSelect}
          className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-all cursor-pointer font-medium"
          required
        >
          <option value="">-- Choose a registered Crop Record --</option>
          {passports.map((p) => (
            <option key={p.id} value={p.id}>
              #{p.id} — {p.crop_name} ({p.quantity} {p.unit}) [{p.status === "minted" ? "Digital Record" : "Registered"}]
            </option>
          ))}
        </select>
        {errors.crop_passport && (
          <p className="text-rose-500 text-xs mt-1">{Array.isArray(errors.crop_passport) ? errors.crop_passport[0] : errors.crop_passport}</p>
        )}
      </div>

      {/* ── 2. Auto-Populated Passport Summary Card ─────────────────── */}
      {selectedPassport && (
        <div className="p-4 bg-slate-50/90 rounded-2xl border border-slate-200/80 space-y-3">
          <div className="flex items-start gap-3">
            {selectedPassport.primary_image_url && (
              <img
                src={selectedPassport.primary_image_url}
                alt={selectedPassport.crop_name}
                className="w-16 h-16 object-cover rounded-xl border border-slate-200 shrink-0"
              />
            )}
            <div className="flex-1 space-y-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-extrabold text-slate-900">
                    {selectedPassport.crop_name}
                  </span>
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-200">
                    {selectedPassport.crop_category}
                  </span>
                </div>
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${
                  selectedPassport.status === "minted"
                    ? "bg-purple-100 text-purple-800 border border-purple-200"
                    : "bg-blue-100 text-blue-800 border border-blue-200"
                }`}>
                  {selectedPassport.status === "minted" ? "📜 Digital Record" : "🌱 Registered"}
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs text-slate-600">
            <div className="bg-white p-2.5 rounded-xl border border-slate-100">
              <span className="text-[10px] text-slate-400 font-bold uppercase block">Lot Quantity</span>
              <span className="font-extrabold text-slate-900 font-mono">
                {selectedPassport.quantity} {selectedPassport.unit}
              </span>
            </div>
            <div className="bg-white p-2.5 rounded-xl border border-slate-100">
              <span className="text-[10px] text-slate-400 font-bold uppercase block">Harvest Date</span>
              <span className="font-semibold text-slate-800">
                {selectedPassport.harvest_date || "N/A"}
              </span>
            </div>
            <div className="bg-white p-2.5 rounded-xl border border-slate-100 col-span-2 sm:col-span-1">
              <span className="text-[10px] text-slate-400 font-bold uppercase block">Origin Location</span>
              <span className="font-semibold text-slate-800 truncate block">
                {selectedPassport.location || "Farm Verified"}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ── 3. Quote Specific Inputs (Asking Price & Deadline) ───────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            Asking Price (₹ INR / {selectedPassport ? selectedPassport.unit : "unit"}) *
          </label>
          <input
            type="number"
            step="any"
            min="1"
            name="price_per_unit"
            placeholder="e.g. 120"
            value={formData.price_per_unit}
            onChange={handleChange}
            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-all font-mono font-semibold"
            required
          />
          <p className="text-[11px] text-slate-500 mt-1">
            Commercial price in ₹ INR. FPOs will see this offer and can bid or negotiate.
          </p>
          {errors.price_per_unit && (
            <p className="text-rose-500 text-xs mt-1">{errors.price_per_unit[0]}</p>
          )}
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            Bidding Deadline *
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

      {/* Live Commercial Calculation & Settlement Breakdown */}
      {settlement && (
        <div className="p-4 bg-emerald-50/80 border border-emerald-200 rounded-2xl space-y-2.5 text-xs">
          <div className="flex items-center justify-between pb-2 border-b border-emerald-200/60">
            <span className="font-bold text-emerald-950 flex items-center gap-1.5">
              <span>📊</span>
              <span>Commercial Pricing & Settlement Preview</span>
            </span>
            <span className="text-[10px] text-emerald-800 font-semibold bg-emerald-100/80 px-2 py-0.5 rounded-full">
              {settlement.exchangeRateNote}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="bg-white/90 p-2.5 rounded-xl border border-emerald-100">
              <span className="text-[10px] text-slate-400 font-bold uppercase block">Quantity</span>
              <span className="font-extrabold text-slate-900 font-mono mt-0.5 block">
                {settlement.quantity} {settlement.unit}
              </span>
            </div>
            <div className="bg-white/90 p-2.5 rounded-xl border border-emerald-100">
              <span className="text-[10px] text-slate-400 font-bold uppercase block">Unit Price</span>
              <span className="font-extrabold text-slate-900 font-mono mt-0.5 block">
                {settlement.formattedUnitPrice}
              </span>
            </div>
            <div className="bg-white/90 p-2.5 rounded-xl border border-emerald-100">
              <span className="text-[10px] text-slate-400 font-bold uppercase block">Total Value (INR)</span>
              <span className="font-extrabold text-emerald-700 font-mono text-sm mt-0.5 block">
                {settlement.formattedTotalInr}
              </span>
            </div>
            <div className="bg-white/90 p-2.5 rounded-xl border border-emerald-100">
              <span className="text-[10px] text-slate-400 font-bold uppercase block">Blockchain Settlement</span>
              <span className="font-bold text-purple-700 font-mono text-xs mt-0.5 block">
                {settlement.formattedAmountEth}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Additional Commercial Notes */}
      <div>
        <label className="block text-xs font-bold text-slate-700 mb-1">
          Additional Commercial / Delivery Notes <span className="text-slate-400 font-normal">(Optional)</span>
        </label>
        <textarea
          name="description"
          placeholder="Enter packaging preferences, delivery readiness, or transport conditions…"
          value={formData.description}
          onChange={handleChange}
          rows={2}
          className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-all resize-none"
        />
        {errors.description && (
          <p className="text-rose-500 text-xs mt-1">{errors.description[0]}</p>
        )}
      </div>

      <button
        type="submit"
        disabled={loading || !selectedPassportId}
        className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 px-4 rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
      >
        <span>{loading ? "Publishing Quote…" : "✅ Publish Supply Quote from Crop Passport"}</span>
      </button>
    </form>
  );
}
