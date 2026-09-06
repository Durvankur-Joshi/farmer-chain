import { useContext, useEffect, useRef } from "react";
import { SocketContext } from "./socketContextDef";

export function useSocket() {
  const ctx = useContext(SocketContext);
  if (!ctx) {
    throw new Error("useSocket must be used within a SocketProvider");
  }
  return ctx;
}

export function useSocketEvent(eventName, callback) {
  const { socket } = useSocket();
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!socket || !eventName) return;

    const handler = (data) => {
      if (typeof callbackRef.current === "function") {
        callbackRef.current(data);
      }
    };

    socket.on(eventName, handler);
    return () => {
      socket.off(eventName, handler);
    };
  }, [socket, eventName]);
}
