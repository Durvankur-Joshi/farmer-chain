import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import { BrowserRouter } from "react-router-dom";
import axios from "axios";
import Cookies from "js-cookie";

// Configure axios base URL for production (Render backend) and local dev (Vite proxy)
// __ENV_API_BASE_URL__ is injected at build time by vite.config.js `define` option
const API_BASE_URL = __ENV_API_BASE_URL__;

if (import.meta.env.PROD && !API_BASE_URL) {
  throw new Error(
    "Backend API URL is not configured. Please set API_BASE_URL in the Vercel Production environment and redeploy."
  );
}

console.log("FarmerChain API base URL:", API_BASE_URL);

axios.defaults.baseURL = API_BASE_URL || "";

// Configure axios to include credentials (cookies) and Authorization header for all requests
axios.defaults.withCredentials = true;

axios.interceptors.request.use((config) => {
  config.withCredentials = true;
  const token =
    localStorage.getItem("access_token") ||
    Cookies.get("access_token") ||
    Cookies.get("token");
  if (token) {
    if (config.headers && typeof config.headers.set === "function") {
      config.headers.set("Authorization", `Bearer ${token}`);
    } else {
      config.headers = config.headers || {};
      config.headers["Authorization"] = `Bearer ${token}`;
    }
  }
  return config;
});

createRoot(document.getElementById("root")).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>
);