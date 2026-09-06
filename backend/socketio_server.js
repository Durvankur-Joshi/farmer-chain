/**
 * FarmerChain Socket.IO Sidecar Server
 *
 * Lightweight relay server that:
 * 1. Accepts HTTP POSTs from Django views after mutations
 * 2. Broadcasts typed events to all connected frontend clients
 *
 * Usage:
 *   cd backend && npm install && node socketio_server.js
 *
 * Django views call:
 *   POST http://localhost:3001/emit  { "event": "crop_updated", "data": {...} }
 */

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
app.use(express.json());

const server = http.createServer(app);

const ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "https://farmer-chain-brown.vercel.app",
];

const io = new Server(server, {
  cors: {
    origin: ALLOWED_ORIGINS,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// ── Socket.IO connection handling ───────────────────────────────────
io.on("connection", (socket) => {
  console.log(`[SocketIO] Client connected: ${socket.id}`);

  // Clients join a role-based room so we can target events if needed
  socket.on("join_role", (role) => {
    if (["farmer", "fpo", "retailer", "admin"].includes(role)) {
      socket.join(role);
      console.log(`[SocketIO] ${socket.id} joined room: ${role}`);
    }
  });

  socket.on("disconnect", (reason) => {
    console.log(`[SocketIO] Client disconnected: ${socket.id} (${reason})`);
  });
});

// ── HTTP endpoint for Django to push events ─────────────────────────
app.post("/emit", (req, res) => {
  const { event, data, room } = req.body;

  if (!event) {
    return res.status(400).json({ error: "Missing 'event' field" });
  }

  if (room) {
    // Target a specific role room
    io.to(room).emit(event, data || {});
  } else {
    // Broadcast to all connected clients
    io.emit(event, data || {});
  }

  console.log(`[SocketIO] Emitted: ${event}${room ? ` → room:${room}` : " → all"}`);
  res.json({ ok: true });
});

// ── Health check ────────────────────────────────────────────────────
app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    connections: io.engine.clientsCount,
    uptime: process.uptime(),
  });
});

// ── Start server ────────────────────────────────────────────────────
const PORT = process.env.SOCKETIO_PORT || 3001;
server.listen(PORT, () => {
  console.log(`[SocketIO] Sidecar server running on http://localhost:${PORT}`);
  console.log(`[SocketIO] Django should POST events to http://localhost:${PORT}/emit`);
});
