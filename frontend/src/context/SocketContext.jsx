import React, { useEffect, useState, useRef, useCallback } from "react";
import { io } from "socket.io-client";
import { SocketContext } from "./socketContextDef";

/**
 * Resolve the Socket.IO server URL.
 *
 * Strategy:
 *  1. If VITE_SOCKET_URL is set (e.g. production override), use it.
 *  2. In local dev, connect to the SAME origin as the Vite dev server
 *     (e.g. http://localhost:5173). Vite's proxy config then forwards
 *     /socket.io → http://127.0.0.1:3001.
 *     This avoids a direct cross-port WebSocket connection that browsers
 *     sometimes block or that fails when the sidecar isn't yet started.
 *  3. In production (non-localhost), always use the same origin so that
 *     the hosting platform's proxy rules apply.
 *
 * Why NOT http://localhost:3001 directly?
 *  - Bypasses the Vite proxy — requires the sidecar to be reachable on
 *    the exact hostname the browser uses (can differ: localhost vs 127.0.0.1).
 *  - Fails in production environments where port 3001 is internal-only.
 *  - Same-origin via proxy is the correct, portable approach.
 */
const getSocketUrl = () => {
  if (typeof window === "undefined") return "";
  // Explicit override for deployment environments
  if (import.meta.env?.VITE_SOCKET_URL) return import.meta.env.VITE_SOCKET_URL;
  // Same-origin: Vite proxy (dev) or hosting proxy (prod) handles /socket.io
  return window.location.origin;
};

export function SocketProvider({ children, role }) {
  const [isConnected, setIsConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState(null);
  const socketRef = useRef(null);

  useEffect(() => {
    const url = getSocketUrl();

    /**
     * Transport order: polling first, then WebSocket upgrade.
     *
     * Socket.IO's default is ["polling", "websocket"] for a reason:
     *  - polling always works (plain HTTP) → handshake succeeds reliably
     *  - Socket.IO then upgrades to WebSocket automatically
     * Using ["websocket"] only would cause the visible browser error when
     * WebSocket is blocked or the sidecar hasn't started yet.
     */
    const socket = io(url, {
      path: "/socket.io",
      transports: ["polling", "websocket"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
      timeout: 10000,
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("[SocketContext] Connected to realtime sidecar:", socket.id);
      setIsConnected(true);

      const activeRole = role || localStorage.getItem("user_role");
      if (activeRole) {
        socket.emit("join_role", activeRole.toLowerCase());
      }
    });

    socket.on("disconnect", (reason) => {
      console.log("[SocketContext] Disconnected from realtime sidecar:", reason);
      setIsConnected(false);
    });

    socket.on("connect_error", (error) => {
      // Log a concise warning — do NOT crash the app.
      // The React app remains fully functional without real-time updates.
      // Socket.IO will automatically retry with exponential backoff.
      console.warn(
        "[SocketContext] Realtime sidecar unavailable — retrying automatically.",
        error.message
      );
      setIsConnected(false);
    });

    // ── FarmerChain real-time event topics ──────────────────────────────
    const events = [
      "crop_updated",
      "quote_updated",
      "bid_updated",
      "deal_updated",
      "negotiation_updated",   // added: negotiation state changes
      "inventory_updated",
      "escrow_updated",
      "transaction_updated",
      "delivery_updated",
      "purchase_completed",
    ];

    events.forEach((evtName) => {
      socket.on(evtName, (data) => {
        console.log(`[SocketContext] Received event: ${evtName}`, data);
        setLastEvent({
          event: evtName,
          data: data || {},
          timestamp: Date.now(),
        });
      });
    });

    return () => {
      // Clean up all listeners and disconnect on unmount
      socket.disconnect();
    };
  }, [role]);

  const emit = useCallback((event, data) => {
    if (socketRef.current && isConnected) {
      socketRef.current.emit(event, data);
    }
  }, [isConnected]);

  return (
    <SocketContext.Provider
      value={{
        socket: socketRef.current,
        isConnected,
        lastEvent,
        emit,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
}
