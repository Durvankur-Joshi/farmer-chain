import React, { useState, useMemo } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import MarketplaceFilterBar from "../common/MarketplaceFilterBar";
import { formatInr } from "../../utils/pricing";
import {
  LayoutGrid,
  List,
  Eye,
  Sprout,
  Package,
  IndianRupee,
  Users,
  Handshake,
  Search,
  Calendar,
  Sparkles,
  CheckCircle2,
  Clock,
  CircleAlert,
} from "lucide-react";

export default function QuoteHistory({ history, onViewBids }) {
  const [filters, setFilters] = useState({});
  const [viewMode, setViewMode] = useState("grid");

  const filteredHistory = useMemo(() => {
    if (!history) return [];

    return history.filter((item) => {
      // Keyword search
      if (filters.search) {
        const q = filters.search.toLowerCase();
        const matchName = item.product_name?.toLowerCase().includes(q);
        const matchCat = item.category?.toLowerCase().includes(q);
        const matchDesc = item.description?.toLowerCase().includes(q);
        if (!matchName && !matchCat && !matchDesc) return false;
      }

      // Category
      if (filters.category && item.category?.toLowerCase() !== filters.category.toLowerCase()) {
        return false;
      }

      // Unit
      if (filters.unit && item.unit?.toLowerCase() !== filters.unit.toLowerCase()) {
        return false;
      }

      // Status
      if (filters.status && item.status?.toLowerCase() !== filters.status.toLowerCase()) {
        return false;
      }

      // Quantity range
      if (filters.min_qty) {
        const min = parseFloat(filters.min_qty);
        if (!isNaN(min) && parseFloat(item.quantity) < min) return false;
      }
      if (filters.max_qty) {
        const max = parseFloat(filters.max_qty);
        if (!isNaN(max) && parseFloat(item.quantity) > max) return false;
      }

      // Harvest date range
      if (filters.harvest_from && item.crop_passport_details?.harvest_date) {
        if (item.crop_passport_details.harvest_date < filters.harvest_from) return false;
      }
      if (filters.harvest_to && item.crop_passport_details?.harvest_date) {
        if (item.crop_passport_details.harvest_date > filters.harvest_to) return false;
      }

      return true;
    });
  }, [history, filters]);

  const hasActiveFilters = Object.values(filters).some((v) => !!v);

  // Helper for status badge
  const renderStatusBadge = (item, hasAcceptedBid) => {
    if (hasAcceptedBid || item.status === "accepted") {
      return (
        <Badge variant="success" className="gap-1">
          <CheckCircle2 className="h-3 w-3" />
          <span>Bid Accepted</span>
        </Badge>
      );
    }
    if (item.status === "open") {
      return (
        <Badge variant="blue" className="gap-1">
          <Clock className="h-3 w-3" />
          <span>Open for Bids</span>
        </Badge>
      );
    }
    if (item.status === "closed" || item.status === "cancelled") {
      return (
        <Badge variant="outline" className="gap-1 text-slate-500">
          <span>{item.status === "closed" ? "Closed" : "Cancelled"}</span>
        </Badge>
      );
    }
    return (
      <Badge variant="secondary">
        <span>{item.status || "Draft"}</span>
      </Badge>
    );
  };

  if (!history || history.length === 0) {
    return (
      <Card className="py-12 text-center bg-slate-50/50 border-dashed">
        <CardContent className="space-y-3">
          <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
            <Handshake className="h-6 w-6" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-900">No Supply Quotes Created Yet</h4>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Create and publish your first harvest lot for verified Farmer Producer Organizations (FPOs) to submit procurement bids.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* ── Search & Filter Bar ─────────────────────────────────────── */}
      <MarketplaceFilterBar
        onFilterChange={setFilters}
        showHarvestDate={true}
        showStatus={true}
        placeholder="Filter quotes by crop name, category, or notes…"
      />

      {/* ── View Controls Bar: Count & Grid/List Switcher ────────────── */}
      <div className="flex items-center justify-between gap-2 pt-1 pb-0.5">
        <p className="text-xs font-semibold text-slate-500">
          Showing <span className="text-slate-800 font-bold">{filteredHistory.length}</span> {filteredHistory.length === 1 ? "deal" : "deals"}
        </p>

        {/* View Switcher */}
        <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200/80">
          <button
            type="button"
            onClick={() => setViewMode("grid")}
            className={`p-1.5 rounded-md transition-all cursor-pointer ${
              viewMode === "grid"
                ? "bg-white text-emerald-700 shadow-2xs"
                : "text-slate-500 hover:text-slate-900"
            }`}
            title="Grid View"
            aria-label="Grid View"
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setViewMode("list")}
            className={`p-1.5 rounded-md transition-all cursor-pointer ${
              viewMode === "list"
                ? "bg-white text-emerald-700 shadow-2xs"
                : "text-slate-500 hover:text-slate-900"
            }`}
            title="List View"
            aria-label="List View"
          >
            <List className="h-4 w-4" />
          </button>
        </div>
      </div>

      {filteredHistory.length > 0 ? (
        viewMode === "grid" ? (
          /* ── GRID / CARD VIEW ────────────────────────────────────── */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {filteredHistory.map((item, index) => {
              const bidsCount = item.bids ? item.bids.length : 0;
              const acceptedBid = item.bids?.find(
                (b) => b.id === item.accepted_bid || b.status === "accepted"
              );
              const hasAcceptedBid = !!item.accepted_bid || !!acceptedBid;

              const qty = parseFloat(item.quantity) || 0;
              const unitPrice = parseFloat(item.price_per_unit) || 0;
              const totalAmount = unitPrice > 0 && qty > 0 ? Math.round(unitPrice * qty) : null;
              const unitPriceDisplay = unitPrice > 0 ? formatInr(unitPrice) : null;
              const totalAmountDisplay = totalAmount != null ? formatInr(totalAmount) : null;

              const counterpartyText = hasAcceptedBid
                ? acceptedBid?.fpo_name || "Verified FPO"
                : bidsCount > 0
                ? `${bidsCount} FPO ${bidsCount === 1 ? "Bid" : "Bids"}`
                : "Awaiting Bids";

              return (
                <Card
                  key={item.id || index}
                  className="flex flex-col justify-between hover:border-emerald-300 hover:shadow-xs transition-all overflow-hidden"
                >
                  <CardHeader className="p-4 pb-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <Sprout className="h-4 w-4 text-emerald-600 shrink-0" />
                          <CardTitle className="text-sm sm:text-base font-bold text-slate-900 truncate">
                            {item.product_name}
                          </CardTitle>
                        </div>
                        <p className="text-xs text-slate-500 font-medium truncate mt-0.5">
                          {item.category}
                        </p>
                      </div>
                      {renderStatusBadge(item, hasAcceptedBid)}
                    </div>

                    {/* Counterparty / Bids Information */}
                    <div className="flex items-center gap-1.5 text-xs text-slate-600 pt-1 border-t border-slate-100">
                      <Users className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                      <span className="font-semibold truncate">
                        {hasAcceptedBid ? "Buyer: " : "Counterparty: "}
                        <span className="text-slate-800 font-bold">{counterpartyText}</span>
                      </span>
                    </div>
                  </CardHeader>

                  <CardContent className="p-4 pt-0 space-y-2.5">
                    {/* Quantity & Commercial Pricing (INR) */}
                    <div className="p-3 bg-slate-50/90 rounded-xl border border-slate-100 grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                          Quantity
                        </span>
                        <span className="font-bold text-slate-800 font-mono text-xs sm:text-sm">
                          {item.quantity} {item.unit}
                        </span>
                        {unitPriceDisplay && (
                          <span className="text-[11px] text-slate-500 block truncate">
                            {unitPriceDisplay} / {item.unit}
                          </span>
                        )}
                      </div>

                      <div className="text-right">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                          Total Value
                        </span>
                        <span className="font-extrabold text-slate-900 font-mono text-xs sm:text-sm block truncate">
                          {totalAmountDisplay || "—"}
                        </span>
                        {item.deadline && (
                          <span className="text-[10px] text-slate-400 block truncate">
                            Due: {item.deadline}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Secondary metadata badge */}
                    {item.crop_passport_details && (
                      <div className="flex items-center gap-1 text-[11px] text-purple-700 bg-purple-50/70 border border-purple-200/70 px-2 py-0.5 rounded-md truncate">
                        <Sparkles className="h-3 w-3 shrink-0" />
                        <span className="truncate">
                          {item.crop_passport_details.is_minted
                            ? "NFT Passport Verified"
                            : `Passport #${item.crop_passport_details.id}`}
                        </span>
                      </div>
                    )}
                  </CardContent>

                  <CardFooter className="p-4 pt-0 border-t border-slate-100">
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => onViewBids(item)}
                      className="w-full h-8 text-xs font-bold gap-1.5 cursor-pointer"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      <span>View Bids {bidsCount > 0 ? `(${bidsCount})` : ""}</span>
                    </Button>
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        ) : (
          /* ── LIST VIEW ───────────────────────────────────────────── */
          <div className="flex flex-col gap-2.5">
            {filteredHistory.map((item, index) => {
              const bidsCount = item.bids ? item.bids.length : 0;
              const acceptedBid = item.bids?.find(
                (b) => b.id === item.accepted_bid || b.status === "accepted"
              );
              const hasAcceptedBid = !!item.accepted_bid || !!acceptedBid;

              const qty = parseFloat(item.quantity) || 0;
              const unitPrice = parseFloat(item.price_per_unit) || 0;
              const totalAmount = unitPrice > 0 && qty > 0 ? Math.round(unitPrice * qty) : null;
              const unitPriceDisplay = unitPrice > 0 ? formatInr(unitPrice) : null;
              const totalAmountDisplay = totalAmount != null ? formatInr(totalAmount) : null;

              const counterpartyText = hasAcceptedBid
                ? acceptedBid?.fpo_name || "Verified FPO"
                : bidsCount > 0
                ? `${bidsCount} FPO ${bidsCount === 1 ? "Bid" : "Bids"}`
                : "Awaiting Bids";

              return (
                <Card
                  key={item.id || index}
                  className="p-3.5 sm:p-4 hover:border-emerald-300 hover:shadow-xs transition-all"
                >
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 min-w-0">
                    {/* Crop & Category */}
                    <div className="flex items-center gap-3 min-w-0 lg:w-1/4">
                      <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                        <Sprout className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-sm font-bold text-slate-900 truncate">
                          {item.product_name}
                        </h4>
                        <span className="text-xs text-slate-500 font-medium truncate block">
                          {item.category}
                        </span>
                      </div>
                    </div>

                    {/* Counterparty & Quantity */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:flex lg:items-center gap-3 text-xs flex-1 min-w-0">
                      <div className="min-w-0">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">
                          Counterparty
                        </span>
                        <span className="font-semibold text-slate-800 truncate block">
                          {counterpartyText}
                        </span>
                      </div>

                      <div className="min-w-0">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">
                          Quantity
                        </span>
                        <span className="font-mono font-bold text-slate-800 truncate block">
                          {item.quantity} {item.unit}
                        </span>
                      </div>

                      <div className="min-w-0">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">
                          Unit Rate
                        </span>
                        <span className="font-mono text-slate-600 truncate block">
                          {unitPriceDisplay ? `${unitPriceDisplay} / ${item.unit}` : "—"}
                        </span>
                      </div>

                      <div className="min-w-0">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">
                          Total (INR)
                        </span>
                        <span className="font-mono font-extrabold text-slate-900 text-sm truncate block">
                          {totalAmountDisplay || "—"}
                        </span>
                      </div>
                    </div>

                    {/* Status Badge & Action Button */}
                    <div className="flex items-center justify-between lg:justify-end gap-3 shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-100">
                      <div className="shrink-0">
                        {renderStatusBadge(item, hasAcceptedBid)}
                      </div>

                      <Button
                        type="button"
                        size="sm"
                        onClick={() => onViewBids(item)}
                        className="h-8 text-xs font-bold gap-1.5 cursor-pointer shrink-0"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        <span>View Bids {bidsCount > 0 ? `(${bidsCount})` : ""}</span>
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )
      ) : hasActiveFilters ? (
        <Card className="py-12 text-center bg-slate-50/50 border-dashed">
          <CardContent className="space-y-3">
            <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center mx-auto">
              <Search className="h-6 w-6" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900">No Matching Quotes Found</h4>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                None of your published supply quotes match your active filter criteria. Try adjusting or clearing your filters.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
