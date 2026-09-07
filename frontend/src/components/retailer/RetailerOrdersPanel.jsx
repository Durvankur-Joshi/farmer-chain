import React, { useState, useEffect, useCallback, useMemo } from "react";
import axios from "axios";
import { useRefreshSubscription } from "../../context/useRefresh";
import ProvenanceCard from "../common/ProvenanceCard";
import BaseModal from "../common/BaseModal";
import StatusBadge from "../common/StatusBadge";

export default function RetailerOrdersPanel() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedOrderModal, setSelectedOrderModal] = useState(null);
  const [statusFilter, setStatusFilter] = useState("all"); // "all" | "active" | "completed"

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await axios.get("/api/retailer/orders/my/", { withCredentials: true });
      setOrders(res.data?.orders || []);
    } catch (err) {
      console.error("Error loading retailer orders:", err);
      setError("Failed to load your commercial orders.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  useRefreshSubscription(["retailer", "deals", "quotes", "escrow", "inventory"], fetchOrders);

  const activeOrders = useMemo(
    () => orders.filter((o) => o.status !== "completed" && o.status !== "cancelled"),
    [orders]
  );
  const completedOrders = useMemo(
    () => orders.filter((o) => o.status === "completed"),
    [orders]
  );

  const filteredOrders = useMemo(() => {
    if (statusFilter === "active") return activeOrders;
    if (statusFilter === "completed") return completedOrders;
    return orders;
  }, [orders, activeOrders, completedOrders, statusFilter]);

  return (
    <div className="space-y-5">
      {/* ── Header Bar ─────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-lg">📋</span>
            <h2 className="text-base font-extrabold text-slate-900">
              Commercial Order Records
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Confirmed commercial procurement orders placed with FPO partners, featuring multi-farmer provenance.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Status Tabs */}
          <div className="bg-slate-100 p-1 rounded-xl flex items-center gap-1 text-xs">
            <button
              type="button"
              onClick={() => setStatusFilter("all")}
              className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                statusFilter === "all"
                  ? "bg-white text-slate-900 shadow-2xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              All ({orders.length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("active")}
              className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                statusFilter === "active"
                  ? "bg-white text-purple-900 shadow-2xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Active ({activeOrders.length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("completed")}
              className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                statusFilter === "completed"
                  ? "bg-white text-emerald-900 shadow-2xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Completed ({completedOrders.length})
            </button>
          </div>

          <button
            type="button"
            onClick={fetchOrders}
            className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 rounded-xl transition-all cursor-pointer text-xs"
            title="Refresh Orders"
          >
            🔄
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 p-4 rounded-2xl text-xs font-semibold">
          ⚠️ {error}
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {[1, 2].map((i) => (
            <div key={i} className="bg-slate-50 border border-slate-200/60 rounded-2xl p-4 animate-pulse space-y-2">
              <div className="h-4 bg-slate-200 rounded w-1/3" />
              <div className="h-10 bg-slate-200 rounded" />
            </div>
          ))}
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="py-12 text-center bg-slate-50/70 rounded-2xl border border-slate-200/80 space-y-2">
          <span className="text-4xl block">📋</span>
          <h3 className="text-sm font-extrabold text-slate-800">
            {statusFilter === "all" ? "No Commercial Orders Yet" : `No ${statusFilter} orders found`}
          </h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Reserve FPO quotes in your Retailer Cart and click "Proceed to Deal" to establish confirmed commercial order records.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {filteredOrders.map((ord) => {
            return (
              <div
                key={ord.id}
                className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-2xs hover:border-purple-300 transition-all flex flex-col justify-between gap-3 min-w-0"
              >
                <div className="space-y-3 min-w-0">
                  {/* Top Bar */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-mono font-semibold text-slate-500">
                          {ord.order_number}
                        </span>
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                          {ord.category || "General"}
                        </span>
                      </div>
                      <h3 className="text-base font-bold text-slate-900 mt-1 truncate">
                        {ord.product_name}
                      </h3>
                      <p className="text-xs text-slate-500 truncate">
                        FPO Partner: <span className="text-slate-800 font-semibold">{ord.fpo_name}</span>
                      </p>
                    </div>

                    <StatusBadge status={ord.status} />
                  </div>

                  {/* Pricing and Volume Grid */}
                  <div className="grid grid-cols-3 gap-2 text-xs bg-slate-50 p-2.5 rounded-xl border border-slate-100 font-mono">
                    <div className="min-w-0">
                      <span className="text-[10px] text-slate-500 font-semibold uppercase block font-sans truncate">Order Volume</span>
                      <span className="font-bold text-purple-900 mt-0.5 block truncate">
                        {ord.quantity} {ord.unit}
                      </span>
                    </div>

                    <div className="min-w-0">
                      <span className="text-[10px] text-slate-500 font-semibold uppercase block font-sans truncate">Unit Rate</span>
                      <span className="font-semibold text-blue-700 mt-0.5 block truncate">
                        {ord.price_per_unit} ETH
                      </span>
                    </div>

                    <div className="min-w-0">
                      <span className="text-[10px] text-slate-500 font-semibold uppercase block font-sans truncate">Total Price</span>
                      <span className="font-bold text-emerald-700 mt-0.5 block truncate">
                        {ord.total_price} ETH
                      </span>
                    </div>
                  </div>
                </div>

                {/* Card Action */}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                  <span className="text-[11px] text-slate-400 font-mono">
                    {new Date(ord.created_at).toLocaleDateString()}
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedOrderModal(ord)}
                    className="px-3.5 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-800 text-xs font-semibold rounded-xl border border-purple-200 transition-all flex items-center gap-1 cursor-pointer"
                  >
                    <span>📜</span>
                    <span>View Deal</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Order Details & Provenance Modal ────────────────────────── */}
      {selectedOrderModal && (
        <BaseModal
          isOpen={Boolean(selectedOrderModal)}
          onClose={() => setSelectedOrderModal(null)}
          title={`Order ${selectedOrderModal.order_number}: ${selectedOrderModal.product_name}`}
          subtitle={`Commercial Agreement · FPO Supplier: ${selectedOrderModal.fpo_name}`}
          icon="📦"
          badge={<StatusBadge status={selectedOrderModal.status} />}
          maxWidth="max-w-2xl"
          footer={
            <div className="flex justify-end w-full">
              <button
                type="button"
                onClick={() => setSelectedOrderModal(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-all cursor-pointer"
              >
                Close
              </button>
            </div>
          }
        >
          <div className="space-y-4 text-xs">
            {/* Commercial Summary Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-100 font-mono">
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase block font-sans">Total Volume</span>
                <span className="font-extrabold text-slate-900 mt-0.5 block">{selectedOrderModal.quantity} {selectedOrderModal.unit}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase block font-sans">Unit Price</span>
                <span className="font-semibold text-blue-700 mt-0.5 block">{selectedOrderModal.price_per_unit} ETH</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase block font-sans">Total Amount</span>
                <span className="font-extrabold text-emerald-700 mt-0.5 block">{selectedOrderModal.total_price} ETH</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase block font-sans">Order Placed</span>
                <span className="font-medium text-slate-700 mt-0.5 block">{new Date(selectedOrderModal.created_at).toLocaleDateString()}</span>
              </div>
            </div>

            {/* Delivery & Logistics Notes if any */}
            {selectedOrderModal.notes && (
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Logistics & Delivery Notes</span>
                <p className="text-slate-700">{selectedOrderModal.notes}</p>
              </div>
            )}

            {/* Complete Provenance Allocations Breakdown */}
            <div className="space-y-2">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-purple-900 block">
                ⛓️ Verified Producer Lineage & Passports
              </span>
              <ProvenanceCard
                allocations={selectedOrderModal.allocations || []}
                provenanceSummary={selectedOrderModal.provenance_summary || {}}
                fpoName={selectedOrderModal.fpo_name}
              />
            </div>
          </div>
        </BaseModal>
      )}
    </div>
  );
}
