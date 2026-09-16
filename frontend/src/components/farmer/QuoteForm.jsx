import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { useRefresh, useRefreshSubscription } from "../../context/useRefresh";
import { formatSettlementBreakdown } from "../../utils/pricing";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle2 } from "lucide-react";

export default function QuoteForm({
  onSuccess,
  onCancel,
  defaultPassportId = null,
  onNavigateToPassports,
}) {
  const { refresh } = useRefresh();
  const [passports, setPassports] = useState([]);
  const [passportsLoading, setPassportsLoading] = useState(true);
  const [selectedPassportId, setSelectedPassportId] = useState(
    defaultPassportId ? String(defaultPassportId) : ""
  );
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

      // Pre-select if specified or single crop
      const targetId = defaultPassportId ? String(defaultPassportId) : (list.length === 1 ? String(list[0].id) : "");
      if (targetId) {
        setSelectedPassportId(targetId);
        const found = list.find((p) => String(p.id) === targetId);
        setSelectedPassport(found || null);
      }
    } catch (err) {
      console.error("Error fetching farmer passports:", err);
    } finally {
      setPassportsLoading(false);
    }
  }, [defaultPassportId]);

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
        text: "Please select a valid crop record for this offer.",
      });
      setLoading(false);
      return;
    }

    const p = parseFloat(formData.price_per_unit);
    if (isNaN(p) || p <= 0) {
      setFeedback({
        type: "error",
        text: "Asking price must be a positive number greater than 0.",
      });
      setLoading(false);
      return;
    }

    if (!formData.deadline) {
      setFeedback({
        type: "error",
        text: "Please specify a bidding deadline in the future.",
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
        text: "Offer published to marketplace! FPOs can now review and place bids.",
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
          text: Array.isArray(firstErr) ? firstErr[0] : firstErr,
        });
      } else {
        setFeedback({
          type: "error",
          text: "Failed to publish offer. Please check your connection and try again.",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  if (passportsLoading) {
    return (
      <div className="py-8 text-center text-xs text-slate-400 animate-pulse space-y-2">
        <p>Loading your registered crop records…</p>
      </div>
    );
  }

  if (!passportsLoading && passports.length === 0) {
    return (
      <div className="py-8 px-4 text-center bg-amber-50/60 rounded-xl border border-amber-200/80 space-y-3">
        <span className="text-3xl block">🌾</span>
        <div className="space-y-1">
          <h3 className="text-xs font-bold text-amber-900">
            No Crop Records Available
          </h3>
          <p className="text-xs text-amber-700 max-w-sm mx-auto">
            You need at least one registered crop before creating a marketplace offer.
          </p>
        </div>
        {onNavigateToPassports && (
          <Button
            type="button"
            size="sm"
            onClick={onNavigateToPassports}
            className="inline-flex items-center gap-1.5"
          >
            <span>🌱</span>
            <span>+ Add Crop First</span>
          </Button>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {feedback && (
        <Alert variant={feedback.type === "success" ? "success" : "destructive"}>
          {feedback.type === "success" ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : (
            <AlertCircle className="h-4 w-4" />
          )}
          <AlertTitle>
            {feedback.type === "success" ? "Offer Published" : "Offer Error"}
          </AlertTitle>
          <AlertDescription>{feedback.text}</AlertDescription>
        </Alert>
      )}

      {/* ── 1. Select Crop Record ─────────────────────────────────── */}
      <div className="space-y-1">
        <label className="block text-xs font-semibold text-slate-700">
          Source Crop Record <span className="text-rose-500">*</span>
        </label>
        <select
          value={selectedPassportId}
          onChange={handlePassportSelect}
          className="w-full px-3 py-2 bg-slate-50/70 hover:bg-white focus:bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-all cursor-pointer font-medium"
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
          <p className="text-rose-500 text-xs mt-1">
            {Array.isArray(errors.crop_passport) ? errors.crop_passport[0] : errors.crop_passport}
          </p>
        )}
      </div>

      {/* ── 2. Auto-Populated Passport Summary Card ─────────────────── */}
      {selectedPassport && (
        <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl space-y-2">
          <div className="flex items-center gap-3">
            {selectedPassport.primary_image_url ? (
              <img
                src={selectedPassport.primary_image_url}
                alt={selectedPassport.crop_name}
                className="w-12 h-12 object-cover rounded-lg border border-slate-200 shrink-0"
              />
            ) : (
              <div className="w-12 h-12 rounded-lg bg-emerald-50 flex items-center justify-center text-xl shrink-0">
                🌾
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-1 flex-wrap">
                <span className="text-xs font-bold text-slate-900 truncate">
                  {selectedPassport.crop_name}
                </span>
                <Badge variant={selectedPassport.status === "minted" ? "purple" : "outline"} className="text-[10px]">
                  {selectedPassport.status === "minted" ? "📜 Digital Record" : "🌱 Registered"}
                </Badge>
              </div>
              <p className="text-[11px] text-slate-500 font-mono">
                Available: {selectedPassport.quantity} {selectedPassport.unit} · {selectedPassport.location || "Farm"}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── 3. Asking Price (INR) & Deadline ──────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Asking Price (₹ INR / {selectedPassport ? selectedPassport.unit : "unit"}) <span className="text-rose-500">*</span>
          </label>
          <input
            type="number"
            step="any"
            min="1"
            name="price_per_unit"
            placeholder="e.g. 120"
            value={formData.price_per_unit}
            onChange={handleChange}
            className="w-full px-3 py-2 bg-slate-50/70 hover:bg-white focus:bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-all font-mono font-bold"
            required
          />
          <span className="text-[10px] text-slate-400 mt-0.5 block">
            Commercial price in INR (₹)
          </span>
          {errors.price_per_unit && (
            <p className="text-rose-500 text-xs mt-1">{errors.price_per_unit[0]}</p>
          )}
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Bidding Deadline <span className="text-rose-500">*</span>
          </label>
          <input
            type="date"
            name="deadline"
            value={formData.deadline}
            onChange={handleChange}
            className="w-full px-3 py-2 bg-slate-50/70 hover:bg-white focus:bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-all font-medium"
            required
          />
          {errors.deadline && (
            <p className="text-rose-500 text-xs mt-1">{errors.deadline[0]}</p>
          )}
        </div>
      </div>

      {/* ── 4. Commercial Settlement Preview ───────────────────────── */}
      {settlement && (
        <div className="p-3 bg-emerald-50/50 border border-emerald-200/80 rounded-xl space-y-2 text-xs">
          <div className="flex items-center justify-between pb-1.5 border-b border-emerald-200/60">
            <span className="font-bold text-emerald-950 flex items-center gap-1 text-[11px]">
              <span>📊</span>
              <span>Commercial Pricing Summary</span>
            </span>
            <span className="text-[10px] text-emerald-800 font-semibold bg-emerald-100/80 px-2 py-0.5 rounded-full">
              {settlement.exchangeRateNote}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="bg-white/80 p-2 rounded-lg border border-emerald-100">
              <span className="text-[10px] text-slate-400 font-medium block">Total Lot Qty</span>
              <span className="font-bold text-slate-900 font-mono block mt-0.5">
                {settlement.quantity} {settlement.unit}
              </span>
            </div>
            <div className="bg-white/80 p-2 rounded-lg border border-emerald-100">
              <span className="text-[10px] text-slate-400 font-medium block">Unit Price</span>
              <span className="font-bold text-slate-900 font-mono block mt-0.5">
                {settlement.formattedUnitPrice}
              </span>
            </div>
            <div className="bg-white/80 p-2 rounded-lg border border-emerald-100">
              <span className="text-[10px] text-slate-400 font-medium block">Total Value (INR)</span>
              <span className="font-bold text-emerald-700 font-mono text-xs block mt-0.5">
                {settlement.formattedTotalInr}
              </span>
            </div>
            <div className="bg-white/80 p-2 rounded-lg border border-emerald-100">
              <span className="text-[10px] text-slate-400 font-medium block">Crypto Settlement</span>
              <span className="font-bold text-purple-700 font-mono text-[11px] block mt-0.5">
                {settlement.formattedAmountEth}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ── 5. Delivery / Commercial Notes ─────────────────────────── */}
      <div>
        <label className="block text-xs font-semibold text-slate-700 mb-1">
          Delivery & Quality Notes <span className="text-slate-400 font-normal">(Optional)</span>
        </label>
        <textarea
          name="description"
          placeholder="Packaging preferences, transport readiness, or warehouse pickup terms…"
          value={formData.description}
          onChange={handleChange}
          rows={2}
          className="w-full px-3 py-2 bg-slate-50/70 hover:bg-white focus:bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-all resize-none font-medium"
        />
        {errors.description && (
          <p className="text-rose-500 text-xs mt-1">{errors.description[0]}</p>
        )}
      </div>

      {/* ── Dialog Footer Actions ───────────────────────────────────── */}
      <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
        {onCancel && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onCancel}
            disabled={loading}
          >
            Cancel
          </Button>
        )}

        <Button
          type="submit"
          size="sm"
          disabled={loading || !selectedPassportId}
        >
          <span>➕</span>
          <span>{loading ? "Publishing Offer…" : "Create & Publish Offer"}</span>
        </Button>
      </div>
    </form>
  );
}
