import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import ProvenanceCard from "../common/ProvenanceCard";

export default function RetailerOrdersPanel() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedOrderId, setExpandedOrderId] = useState(null);

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-slate-100 pb-4">
        <div>
          <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
            <span>📦</span>
            <span>Commercial Orders & Provenance Records</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Commercial orders placed with FPO partners, featuring 100% verified farmer & crop passport provenance.
          </p>
        </div>

        <button
          type="button"
          onClick={fetchOrders}
          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1"
        >
          <span>🔄</span>
          <span>Refresh</span>
        </button>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 p-4 rounded-2xl text-xs font-semibold">
          ⚠️ {error}
        </div>
      )}

      {loading ? (
        <div className="py-12 text-center text-xs text-slate-400 animate-pulse space-y-2">
          <div className="h-6 w-48 bg-slate-200 rounded mx-auto" />
          <p>Loading commercial orders…</p>
        </div>
      ) : orders.length === 0 ? (
        <div className="py-12 text-center bg-slate-50 rounded-2xl border border-slate-200/80 space-y-3">
          <span className="text-4xl block">📋</span>
          <h3 className="text-sm font-extrabold text-slate-800">No Commercial Orders Yet</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Reserve FPO quotes in your Retailer Cart and click "Proceed to Commercial Order" to establish order records.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((ord) => {
            const allocations = ord.allocations || [];
            const provSummary = ord.provenance_summary || {};
            const isExpanded = expandedOrderId === ord.id;

            return (
              <div
                key={ord.id}
                className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-2xs hover:border-emerald-300 transition-all space-y-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="text-xs font-mono font-extrabold px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200">
                      {ord.order_number}
                    </span>
                    <span className="text-base font-extrabold text-slate-900">
                      {ord.product_name}
                    </span>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                      {ord.category || "General"}
                    </span>
                    <span className="text-[10px] uppercase font-extrabold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200">
                      {ord.status}
                    </span>
                  </div>

                  <span className="text-xs font-mono text-slate-400">
                    {new Date(ord.created_at).toLocaleString()}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">FPO Partner</span>
                    <span className="font-extrabold text-slate-800 block mt-0.5">{ord.fpo_name}</span>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Order Quantity</span>
                    <span className="font-mono font-extrabold text-purple-700 block mt-0.5">
                      {ord.quantity} {ord.unit}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Price per Unit</span>
                    <span className="font-mono font-bold text-blue-700 block mt-0.5">
                      {ord.price_per_unit} ETH / {ord.unit}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Total Order Price</span>
                    <span className="font-mono font-extrabold text-emerald-700 block mt-0.5 text-sm">
                      {ord.total_price} ETH
                    </span>
                  </div>
                </div>

                {/* Provenance Details Box */}
                <ProvenanceCard
                  allocations={allocations}
                  provenanceSummary={provSummary}
                  fpoName={ord.fpo_name}
                />

                {ord.notes && (
                  <div className="text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <strong className="text-slate-500">Logistics Notes:</strong> {ord.notes}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
