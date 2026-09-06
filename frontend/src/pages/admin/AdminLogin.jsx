import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

export default function AdminLogin() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
    role: "admin",
  });
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (e) =>
    setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus("");
    setLoading(true);
    
    try {
      axios.defaults.withCredentials = true;
      await axios.post("/api/token/", formData, {
        withCredentials: true
      });
      navigate("/admin-dashboard");
    } catch {
      setStatus("❌ Invalid credentials or server error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col justify-between relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-blue-500/10 blur-[120px] pointer-events-none" />

      {/* Top Header */}
      <header className="px-6 py-5 max-w-6xl mx-auto w-full flex justify-between items-center z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-700 to-slate-900 border border-slate-700 flex items-center justify-center text-xl shadow-lg text-white font-bold">
            🛡️
          </div>
          <div>
            <span className="font-extrabold text-white text-xl tracking-tight">
              FarmerChain Admin
            </span>
            <p className="text-[11px] text-slate-400 font-medium">
              Protocol Governance & Participant Approval
            </p>
          </div>
        </div>

        <a
          href="/"
          className="text-xs font-semibold text-slate-400 hover:text-slate-200 px-3 py-1.5 rounded-lg border border-slate-800 hover:border-slate-700 bg-slate-800/50 transition-all"
        >
          ← Back to User Portal
        </a>
      </header>

      {/* Main Login Card */}
      <main className="flex-1 flex items-center justify-center p-4 z-10">
        <form
          onSubmit={handleSubmit}
          className="w-full max-w-md bg-slate-800/80 backdrop-blur-xl border border-slate-700/80 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-black/40"
        >
          <div className="text-center mb-6">
            <h1 className="text-2xl font-extrabold text-white tracking-tight">
              Admin Authentication
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Authorized protocol administrators only
            </p>
          </div>

          {status && (
            <div className="p-3 mb-4 rounded-xl text-xs font-medium bg-rose-500/10 border border-rose-500/20 text-rose-300 text-center">
              {status}
            </div>
          )}

          <div className="space-y-3.5">
            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                Admin Username
              </label>
              <input
                type="text"
                name="username"
                placeholder="admin username"
                value={formData.username}
                onChange={handleChange}
                required
                className="w-full px-3.5 py-2.5 bg-slate-900/80 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                Admin Email
              </label>
              <input
                type="email"
                name="email"
                placeholder="admin@farmerchain.com"
                value={formData.email}
                onChange={handleChange}
                required
                className="w-full px-3.5 py-2.5 bg-slate-900/80 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                Security Password
              </label>
              <input
                type="password"
                name="password"
                placeholder="••••••••••••"
                value={formData.password}
                onChange={handleChange}
                required
                className="w-full px-3.5 py-2.5 bg-slate-900/80 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold py-3 px-4 rounded-xl transition-all shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 cursor-pointer mt-2 disabled:opacity-50"
            >
              {loading ? "Authenticating…" : "Access Command Center"}
            </button>
          </div>
        </form>
      </main>

      {/* Footer */}
      <footer className="px-6 py-4 max-w-6xl mx-auto w-full text-center text-[11px] text-slate-500 z-10">
        FarmerChain Protocol Governance · Administrative Access Only
      </footer>
    </div>
  );
}