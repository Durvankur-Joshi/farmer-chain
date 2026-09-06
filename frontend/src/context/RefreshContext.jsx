import React, { useState, useCallback, useEffect } from "react";
import { RefreshContext } from "./refreshContextDef";
import { useSocket } from "./useSocket";

// Supported domains:
// "farmer", "fpo", "retailer", "quotes", "bids", "deals", "inventory", "escrow", "transactions"

const EVENT_DOMAIN_MAP = {
  crop_updated: ["farmer", "inventory", "quotes"],
  quote_updated: ["quotes", "farmer", "fpo", "retailer"],
  bid_updated: ["bids", "quotes", "deals", "farmer", "fpo", "retailer"],
  deal_updated: ["deals", "quotes", "bids", "escrow", "farmer", "fpo", "retailer"],
  inventory_updated: ["inventory", "fpo", "retailer"],
  escrow_updated: ["escrow", "deals", "farmer", "fpo", "retailer"],
  transaction_updated: ["transactions", "escrow", "deals"],
  delivery_updated: ["deals", "escrow", "inventory", "farmer", "fpo", "retailer"],
  purchase_completed: ["deals", "inventory", "transactions", "farmer", "fpo", "retailer"],
};

function SocketRefreshBridge({ refresh }) {
  const { lastEvent } = useSocket();

  useEffect(() => {
    if (!lastEvent?.event) return;
    const domains = EVENT_DOMAIN_MAP[lastEvent.event];
    if (domains && domains.length > 0) {
      console.log(`[SocketRefreshBridge] Event "${lastEvent.event}" triggered refresh for domains:`, domains);
      refresh(domains);
    }
  }, [lastEvent, refresh]);

  return null;
}

export function RefreshProvider({ children }) {
  const [versions, setVersions] = useState({
    farmer: 0,
    fpo: 0,
    retailer: 0,
    quotes: 0,
    bids: 0,
    deals: 0,
    inventory: 0,
    escrow: 0,
    transactions: 0,
  });

  const [isRefreshing, setIsRefreshing] = useState(false);

  // Core targeted refresh trigger
  const refresh = useCallback((domains) => {
    const domainList = Array.isArray(domains) ? domains : [domains];
    if (typeof process !== "undefined" && process.env?.NODE_ENV !== "production") {
      console.log("[RefreshContext] Triggered refresh for:", domainList);
    }

    setVersions((prev) => {
      const next = { ...prev };
      domainList.forEach((d) => {
        next[d] = (next[d] || 0) + 1;
      });
      return next;
    });
  }, []);

  // Dedicated domain helper triggers
  const refreshFarmer = useCallback(() => refresh(["farmer", "quotes", "bids", "deals", "escrow"]), [refresh]);
  const refreshFpo = useCallback(() => refresh(["fpo", "quotes", "bids", "deals", "inventory", "escrow"]), [refresh]);
  const refreshRetailer = useCallback(() => refresh(["retailer", "quotes", "bids", "deals", "inventory", "escrow", "transactions"]), [refresh]);
  const refreshQuotes = useCallback(() => refresh(["quotes", "deals", "farmer", "fpo", "retailer"]), [refresh]);
  const refreshBids = useCallback(() => refresh(["bids", "deals", "farmer", "fpo", "retailer"]), [refresh]);
  const refreshDeals = useCallback(() => refresh(["deals", "quotes", "bids", "escrow"]), [refresh]);
  const refreshInventory = useCallback(() => refresh(["inventory", "fpo", "retailer"]), [refresh]);
  const refreshEscrow = useCallback(() => refresh(["escrow", "deals", "transactions", "inventory", "farmer", "fpo", "retailer"]), [refresh]);
  const refreshTransactions = useCallback(() => refresh(["transactions", "escrow", "farmer", "retailer"]), [refresh]);

  return (
    <RefreshContext.Provider
      value={{
        versions,
        refresh,
        refreshFarmer,
        refreshFpo,
        refreshRetailer,
        refreshQuotes,
        refreshBids,
        refreshDeals,
        refreshInventory,
        refreshEscrow,
        refreshTransactions,
        isRefreshing,
        setIsRefreshing,
      }}
    >
      <SocketRefreshBridge refresh={refresh} />
      {children}
    </RefreshContext.Provider>
  );
}
