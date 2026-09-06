import React, { useEffect, useState, useRef, useCallback } from "react";
import { io } from "socket.io-client";
import { SocketContext } from "./socketContextDef";

const getSocketUrl = () => {
  if (typeof window === "undefined") return "http://localhost:3001";
  if (import.meta.env?.VITE_SOCKET_URL) return import.meta.env.VITE_SOCKET_URL;
  if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
    return `http://${window.location.hostname}:3001`;
  }
  return window.location.origin;
};

export function SocketProvider({ children, role }) {
  const [isConnected, setIsConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState(null);
  const socketRef = useRef(null);

  useEffect(() => {
    const url = getSocketUrl();
    const socket = io(url, {
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
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
      console.warn("[SocketContext] Realtime connection warning:", error.message);
      setIsConnected(false);
    });

    // Listen to all defined FarmerChain real-time event topics
    const events = [
      "crop_updated",
      "quote_updated",
      "bid_updated",
      "deal_updated",
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
