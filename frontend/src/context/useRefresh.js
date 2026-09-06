import { useContext, useEffect, useRef } from "react";
import { RefreshContext } from "./refreshContextDef";

/**
 * Hook to access the refresh context.
 * Returns:
 * - refresh(domains): function to trigger refresh on specific domain(s)
 * - refreshAll(): function to trigger refresh on all domains
 * - versions: object containing version numbers for all domains
 * - isRefreshing: boolean indicating active refresh
 * - setIsRefreshing: function to update active refresh status
 */
export function useRefresh() {
  const ctx = useContext(RefreshContext);
  if (!ctx) {
    throw new Error("useRefresh must be used within a RefreshProvider");
  }
  return ctx;
}

/**
 * Hook to subscribe a component to one or more data domains.
 * The callback will automatically execute whenever any of the specified domains are refreshed.
 *
 * @param {string|string[]} domains Domain or list of domains to listen to
 * @param {Function} callback Function to execute on refresh
 */
export function useRefreshSubscription(domains, callback) {
  const { versions } = useRefresh();
  const domainKey = Array.isArray(domains) ? domains.join(",") : (domains || "");
  const lastVersionsRef = useRef({});
  const isMountedRef = useRef(false);
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    const domainList = domainKey ? domainKey.split(",") : [];
    if (!isMountedRef.current) {
      isMountedRef.current = true;
      domainList.forEach((d) => {
        lastVersionsRef.current[d] = versions[d] || 0;
      });
      return;
    }

    const hasChanged = domainList.some((d) => {
      const current = versions[d] || 0;
      const last = lastVersionsRef.current[d] || 0;
      return current !== last;
    });

    if (hasChanged) {
      domainList.forEach((d) => {
        lastVersionsRef.current[d] = versions[d] || 0;
      });
      if (typeof callbackRef.current === "function") {
        callbackRef.current();
      }
    }
  }, [versions, domainKey]);
}
