import React, { useState } from "react";
import axios from "axios";
import Cookies from "js-cookie";
import { useNavigate } from "react-router-dom";

export default function AuthForm() {
  const [isLogin, setIsLogin] = useState(true);
  const navigate = useNavigate();
  const [role, setRole] = useState("farmer");
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    aadhaar_number: "",
    corporate_identification_number: "",
    gstin: "",
    city: "",
    state: "",
    wallet_address: "",
    role: "farmer",
  });

  const [pendingApproval, setPendingApproval] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleRoleChange = (selectedRole) => {
    setRole(selectedRole);
    setFormData({ ...formData, role: selectedRole });
    setErrorMsg("");
  };

  const connectWallet = async () => {
    if (window.ethereum) {
      try {
        const accounts = await window.ethereum.request({
          method: "eth_requestAccounts",
        });
        setFormData({ ...formData, wallet_address: accounts[0] });
      } catch (error) {
        console.error("Wallet connection failed", error);
        setErrorMsg("MetaMask connection was cancelled.");
      }
    } else {
      alert("MetaMask not found! Please install MetaMask extension to continue.");
    }
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setErrorMsg("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg("");
    setSubmitting(true);

    let endpoint = "";
    let payload = {};

    axios.defaults.withCredentials = true;

    if (isLogin) {
      endpoint = "/api/token/";
      payload = {
        username: formData.email,
        email: formData.email,
        password: formData.password,
        role: role,
      };
    } else {
      endpoint = `/api/${role}/register/`;
      payload = { ...formData };
      if (!payload.wallet_address) {
        setErrorMsg("⚠️ Please connect your MetaMask wallet before registering.");
        setSubmitting(false);
        return;
      }
    }

    try {
      const res = await axios.post(endpoint, payload, {
        headers: { "Content-Type": "application/json" },
        withCredentials: true,
      });

      if (isLogin) {
        if (res.data.access) {
          localStorage.setItem("access_token", res.data.access);
          Cookies.set("access_token", res.data.access, { path: "/", expires: 7 });
          Cookies.set("token", res.data.access, { path: "/", expires: 7 });
        }
        Cookies.set("role", role, { path: "/", expires: 7 });

        if (role === "farmer") {
          Cookies.set("farmer_id", res.data.farmer_id || res.data.user_id, { path: "/", expires: 7 });
          navigate("/farmer-dashboard");
        } else if (role === "fpo") {
          Cookies.set("fpo_id", res.data.fpo_id || res.data.user_id, { path: "/", expires: 7 });
          navigate("/fpo-dashboard");
        } else if (role === "retailer") {
          Cookies.set("retailer_id", res.data.retailer_id || res.data.user_id, { path: "/", expires: 7 });
          navigate("/retailer-dashboard");
        }
      } else {
        setPendingApproval(true);
      }
    } catch (err) {
      console.error("Auth error:", err.response?.data || err);
      let msg = "";
      if (err.response?.data?.error) {
        msg = typeof err.response.data.error === "string" ? err.response.data.error : JSON.stringify(err.response.data.error);
      } else if (err.response?.data?.detail) {
        msg = typeof err.response.data.detail === "string" ? err.response.data.detail : JSON.stringify(err.response.data.detail);
      } else if (err.response?.data?.non_field_errors) {
        msg = err.response.data.non_field_errors[0];
      } else {
        msg = isLogin ? "Invalid email, password, or unapproved account." : "Registration failed. Check details and wallet uniqueness.";
      }
      setErrorMsg(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col justify-between relative overflow-hidden">
      {/* Background Glows */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-emerald-500/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-blue-500/10 blur-[120px] pointer-events-none" />

      {/* Top Brand Header */}
      <header className="px-6 py-5 max-w-6xl mx-auto w-full flex justify-between items-center z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-green-600 flex items-center justify-center text-xl shadow-lg shadow-emerald-500/20 text-white font-bold">
            🌾
          </div>
          <div>
            <span className="font-extrabold text-white text-xl tracking-tight">
              FarmerChain
            </span>
            <p className="text-[11px] text-slate-400 font-medium">
              Web3 Agricultural Trust & Escrow Protocol
            </p>
          </div>
        </div>

        <a
          href="/admin"
          className="text-xs font-semibold text-slate-400 hover:text-slate-200 px-3 py-1.5 rounded-lg border border-slate-800 hover:border-slate-700 bg-slate-800/50 transition-all"
        >
          🛡️ Admin Portal
        </a>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center p-4 z-10">
        {/* Pending Approval Modal */}
        {pendingApproval && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
            <div className="bg-slate-800 border border-slate-700 max-w-md w-full rounded-2xl p-6 text-center shadow-2xl">
              <div className="w-14 h-14 mx-auto rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-2xl mb-4">
                ⏳
              </div>
              <h3 className="text-lg font-bold text-white mb-2">
                Registration Submitted!
              </h3>
              <p className="text-sm text-slate-300 mb-6 leading-relaxed">
                Your account is currently <span className="text-amber-400 font-semibold">Pending Admin Approval</span>. Once approved by the administrator, your DID will be active and you will be able to log in.
              </p>
              <button
                type="button"
                onClick={() => {
                  setPendingApproval(false);
                  setIsLogin(true);
                }}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-2.5 rounded-xl transition-all shadow-lg shadow-emerald-600/20 cursor-pointer"
              >
                Go to Sign In
              </button>
            </div>
          </div>
        )}

        {/* Auth Card */}
        <div className="w-full max-w-md bg-slate-800/80 backdrop-blur-xl border border-slate-700/80 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-black/40">
          {/* Form Header */}
          <div className="text-center mb-6">
            <h1 className="text-2xl font-extrabold text-white tracking-tight">
              {isLogin ? "Welcome Back" : "Join FarmerChain"}
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              {isLogin ? "Sign in to access your Web3 decentralized portal" : "Create your decentralized agricultural identity"}
            </p>
          </div>

          {/* Role Selector Tabs */}
          <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-900/80 rounded-xl border border-slate-700/60 mb-5">
            {[
              { id: "farmer", label: "Farmer", icon: "🌱" },
              { id: "fpo", label: "FPO", icon: "🏢" },
              { id: "retailer", label: "Retailer", icon: "🏪" },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleRoleChange(tab.id)}
                className={`py-2 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer ${
                  role === tab.id
                    ? "bg-emerald-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                }`}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </div>

          {/* Error Message */}
          {errorMsg && (
            <div className="p-3 mb-4 rounded-xl text-xs font-medium bg-rose-500/10 border border-rose-500/20 text-rose-300 flex items-start gap-2">
              <span>⚠️</span>
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-3.5">
            {!isLogin && (
              <>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Full Name / Organization
                  </label>
                  <input
                    type="text"
                    name="name"
                    placeholder="e.g. Ramesh Patil / Sahyadri Farmers FPO"
                    value={formData.name}
                    onChange={handleChange}
                    className="w-full px-3.5 py-2.5 bg-slate-900/80 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-all"
                    required
                  />
                </div>

                {role === "farmer" && (
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      Aadhaar Number (12 Digits)
                    </label>
                    <input
                      type="text"
                      name="aadhaar_number"
                      placeholder="12-digit Aadhaar"
                      value={formData.aadhaar_number}
                      onChange={handleChange}
                      className="w-full px-3.5 py-2.5 bg-slate-900/80 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-all"
                      required
                    />
                  </div>
                )}

                {role === "fpo" && (
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      Corporate Identification Number (CIN)
                    </label>
                    <input
                      type="text"
                      name="corporate_identification_number"
                      placeholder="CIN registration identifier"
                      value={formData.corporate_identification_number}
                      onChange={handleChange}
                      className="w-full px-3.5 py-2.5 bg-slate-900/80 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-all"
                      required
                    />
                  </div>
                )}

                {role === "retailer" && (
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      GSTIN Identifier (15 Characters)
                    </label>
                    <input
                      type="text"
                      name="gstin"
                      placeholder="GSTIN registration"
                      value={formData.gstin}
                      onChange={handleChange}
                      className="w-full px-3.5 py-2.5 bg-slate-900/80 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-all"
                      required
                    />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      City / District
                    </label>
                    <input
                      type="text"
                      name="city"
                      placeholder="City"
                      value={formData.city}
                      onChange={handleChange}
                      className="w-full px-3.5 py-2.5 bg-slate-900/80 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-all"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      State
                    </label>
                    <input
                      type="text"
                      name="state"
                      placeholder="State"
                      value={formData.state}
                      onChange={handleChange}
                      className="w-full px-3.5 py-2.5 bg-slate-900/80 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-all"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Sepolia Web3 Wallet
                  </label>
                  <button
                    type="button"
                    onClick={connectWallet}
                    className={`w-full py-2.5 px-3 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-2 cursor-pointer ${
                      formData.wallet_address
                        ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-300"
                        : "bg-purple-600 hover:bg-purple-500 text-white border-purple-500 shadow-md shadow-purple-600/20"
                    }`}
                  >
                    <span>🦊</span>
                    <span>
                      {formData.wallet_address
                        ? `Connected: ${formData.wallet_address.slice(0, 8)}…${formData.wallet_address.slice(-6)}`
                        : "Connect MetaMask Wallet"}
                    </span>
                  </button>
                </div>
              </>
            )}

            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                Email Address
              </label>
              <input
                type="email"
                name="email"
                placeholder="name@domain.com"
                value={formData.email}
                onChange={handleChange}
                className="w-full px-3.5 py-2.5 bg-slate-900/80 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-all"
                required
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                Password
              </label>
              <input
                type="password"
                name="password"
                placeholder="••••••••••••"
                value={formData.password}
                onChange={handleChange}
                className="w-full px-3.5 py-2.5 bg-slate-900/80 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-all"
                required
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white font-bold py-3 px-4 rounded-xl transition-all shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 cursor-pointer mt-2 disabled:opacity-50"
            >
              {submitting ? (
                <span>Processing…</span>
              ) : (
                <span>{isLogin ? `Sign In as ${role.toUpperCase()}` : `Create ${role.toUpperCase()} Account`}</span>
              )}
            </button>
          </form>

          {/* Toggle Mode */}
          <div className="mt-6 pt-4 border-t border-slate-700/60 text-center">
            <p className="text-xs text-slate-400">
              {isLogin ? "New to FarmerChain?" : "Already have an approved account?"}{" "}
              <button
                type="button"
                onClick={() => {
                  setIsLogin(!isLogin);
                  setErrorMsg("");
                }}
                className="text-emerald-400 font-bold hover:text-emerald-300 hover:underline cursor-pointer ml-1"
              >
                {isLogin ? "Register Now" : "Sign In"}
              </button>
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="px-6 py-4 max-w-6xl mx-auto w-full text-center text-[11px] text-slate-500 z-10">
        FarmerChain Decentralized Trust Protocol · Powered by Ethereum Sepolia, W3C DID, IPFS & Gemini AI
      </footer>
    </div>
  );
}
