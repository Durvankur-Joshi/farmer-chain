import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import { BrowserRouter } from "react-router-dom";
import axios from "axios";
import Cookies from "js-cookie";

// Configure axios to include credentials (cookies) and Authorization header for all requests
axios.defaults.withCredentials = true;

axios.interceptors.request.use((config) => {
  config.withCredentials = true;
  const token =
    localStorage.getItem("access_token") ||
    Cookies.get("access_token") ||
    Cookies.get("token");
  if (token && !config.headers.Authorization) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

createRoot(document.getElementById("root")).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>
);