import React, { useState, useEffect } from "react";
import { SUPPORTED_UNITS } from "../../utils/pricing";

export default function MarketplaceFilterBar({
  onFilterChange,
  showHarvestDate = true,
  showStatus = false,
  placeholder = "Search by crop or keyword…",
}) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [unit, setUnit] = useState("");
  const [minQty, setMinQty] = useState("");
  const [maxQty, setMaxQty] = useState("");
  const [harvestFrom, setHarvestFrom] = useState("");
  const [harvestTo, setHarvestTo] = useState("");
  const [status, setStatus] = useState("");
  const [qtyError, setQtyError] = useState(null);
  const [dateError, setDateError] = useState(null);
  const [isExpanded, setIsExpanded] = useState(false);

  const onFilterChangeRef = React.useRef(onFilterChange);
  React.useEffect(() => {
    onFilterChangeRef.current = onFilterChange;
  }, [onFilterChange]);

  const prevFiltersRef = React.useRef(null);

  // Validate and propagate changes
  useEffect(() => {
    let hasError = false;

    // Quantity range validation
    const minVal = minQty ? parseFloat(minQty) : null;
    const maxVal = maxQty ? parseFloat(maxQty) : null;

    if (minVal !== null && minVal < 0) {
      setQtyError("Minimum quantity cannot be negative.");
      hasError = true;
    } else if (maxVal !== null && maxVal < 0) {
      setQtyError("Maximum quantity cannot be negative.");
      hasError = true;
    } else if (minVal !== null && maxVal !== null && minVal > maxVal) {
      setQtyError("Min quantity cannot exceed Max quantity.");
      hasError = true;
    } else {
      setQtyError(null);
    }

    // Date range validation
    if (harvestFrom && harvestTo && harvestFrom > harvestTo) {
      setDateError("'From' date cannot be after 'To' date.");
      hasError = true;
    } else {
      setDateError(null);
    }

    if (!hasError) {
      const payload = {
        search: search.trim(),
        category,
        unit,
        min_qty: minVal !== null ? String(minVal) : "",
        max_qty: maxVal !== null ? String(maxVal) : "",
        harvest_from: harvestFrom,
        harvest_to: harvestTo,
        status,
      };

      const payloadStr = JSON.stringify(payload);

      // Only notify parent if filter payload actually changed
      if (prevFiltersRef.current !== payloadStr) {
        prevFiltersRef.current = payloadStr;
        if (onFilterChangeRef.current) {
          onFilterChangeRef.current(payload);
        }
      }
    }
  }, [search, category, unit, minQty, maxQty, harvestFrom, harvestTo, status]);

  const handleClear = () => {
    setSearch("");
    setCategory("");
    setUnit("");
    setMinQty("");
    setMaxQty("");
    setHarvestFrom("");
    setHarvestTo("");
    setStatus("");
    setQtyError(null);
    setDateError(null);
  };

  const hasActiveFilters =
    !!search ||
    !!category ||
    !!unit ||
    !!minQty ||
    !!maxQty ||
    !!harvestFrom ||
    !!harvestTo ||
    !!status;

  return (
    <div className="bg-slate-50/80 border border-slate-200/90 rounded-2xl p-3.5 sm:p-4 space-y-3 shadow-2xs">
      {/* ── Top Search & Quick Category Row ─────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:flex lg:items-center gap-2.5 sm:gap-3">
        {/* Keyword Search Input */}
        <div className="relative flex-1 sm:col-span-2 lg:col-span-1 min-w-0">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
            🔍
          </span>
          <input
            type="text"
            placeholder={placeholder}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-7 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none transition-all"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs p-1"
            >
              ✕
            </button>
          )}
        </div>

        {/* Category Dropdown */}
        <div className="w-full lg:w-44 shrink-0">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-700 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none transition-all cursor-pointer font-medium"
          >
            <option value="">All Categories</option>
            <option value="Grains">Grains</option>
            <option value="Vegetables">Vegetables</option>
            <option value="Fruits">Fruits</option>
            <option value="Pulses">Pulses</option>
            <option value="Oilseeds">Oilseeds</option>
            <option value="Dairy">Dairy</option>
          </select>
        </div>

        {/* Unit Dropdown */}
        <div className="w-full lg:w-36 shrink-0">
          <select
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-700 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none transition-all cursor-pointer font-medium"
          >
            <option value="">All Units</option>
            {SUPPORTED_UNITS.map((u) => (
              <option key={u.value} value={u.value}>
                {u.label}
              </option>
            ))}
          </select>
        </div>

        {/* Action Buttons Group */}
        <div className="flex items-center gap-2 sm:col-span-2 lg:col-span-1 shrink-0">
          {/* Toggle Detailed Filters Button */}
          <button
            type="button"
            onClick={() => setIsExpanded((v) => !v)}
            className={`flex-1 sm:flex-none px-3 py-2 text-xs font-bold rounded-xl border transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              isExpanded || minQty || maxQty || harvestFrom || harvestTo
                ? "bg-purple-100 text-purple-800 border-purple-300"
                : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
            }`}
          >
            <span>⚙️</span>
            <span>{isExpanded ? "Fewer Filters" : "More Filters"}</span>
          </button>

          {/* Clear Filters Button */}
          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleClear}
              className="px-3 py-2 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl transition-all flex items-center justify-center gap-1 cursor-pointer"
            >
              <span>✕</span>
              <span>Clear</span>
            </button>
          )}
        </div>
      </div>

      {/* ── Expanded Filters (Quantity Range & Harvest Date) ─────────── */}
      {isExpanded && (
        <div className="pt-3 border-t border-slate-200/80 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 animate-fade-in text-xs">
          {/* Min Quantity */}
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
              Min Quantity
            </label>
            <input
              type="number"
              min="0"
              step="any"
              placeholder="0"
              value={minQty}
              onChange={(e) => setMinQty(e.target.value)}
              className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:border-purple-500 outline-none font-mono"
            />
          </div>

          {/* Max Quantity */}
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
              Max Quantity
            </label>
            <input
              type="number"
              min="0"
              step="any"
              placeholder="10000"
              value={maxQty}
              onChange={(e) => setMaxQty(e.target.value)}
              className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:border-purple-500 outline-none font-mono"
            />
          </div>

          {/* Harvest Date From */}
          {showHarvestDate && (
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                Harvest After
              </label>
              <input
                type="date"
                value={harvestFrom}
                onChange={(e) => setHarvestFrom(e.target.value)}
                className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:border-purple-500 outline-none"
              />
            </div>
          )}

          {/* Harvest Date To */}
          {showHarvestDate && (
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                Harvest Before
              </label>
              <input
                type="date"
                value={harvestTo}
                onChange={(e) => setHarvestTo(e.target.value)}
                className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:border-purple-500 outline-none"
              />
            </div>
          )}

          {/* Optional Status filter */}
          {showStatus && (
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:border-purple-500 outline-none cursor-pointer"
              >
                <option value="">All Statuses</option>
                <option value="open">Open</option>
                <option value="accepted">Accepted</option>
                <option value="awarded">Awarded</option>
                <option value="closed">Closed</option>
              </select>
            </div>
          )}
        </div>
      )}

      {/* ── Validation Alerts ────────────────────────────────────────── */}
      {qtyError && (
        <p className="text-[11px] font-semibold text-rose-600 bg-rose-50 px-2.5 py-1 rounded-lg border border-rose-200">
          ⚠️ {qtyError}
        </p>
      )}
      {dateError && (
        <p className="text-[11px] font-semibold text-rose-600 bg-rose-50 px-2.5 py-1 rounded-lg border border-rose-200">
          ⚠️ {dateError}
        </p>
      )}
    </div>
  );
}
