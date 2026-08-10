import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ethers } from "ethers";
import axios from "axios";
import Cookies from "js-cookie";
import AddressCopy from "../../components/common/AddressCopy";

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [wallet, setWallet] = useState("");
  const [status, setStatus] = useState("");
  const [loadingTx, setLoadingTx] = useState(false);
  const [activeTab, setActiveTab] = useState("all");
  const [pending, setPending] = useState({
    farmers: [],
    fpos: [],
    retailers: [],
  });
  const [didInfo, setDidInfo] = useState(null);
  const [copyMsg, setCopyMsg] = useState("");

  // Contract + Admin
  const contractAddress = "0x7022b2D5462cBE3785FF5359E19f18eD396D8397";
  const ADMIN_ADDRESS = "0xAd91CE97681d52fE448a71E6556DdECc16f12B2E";

  const factoryABI = [
    {
      inputs: [
        { internalType: "string", name: "_farmerName", type: "string" },
        { internalType: "string", name: "_location", type: "string" },
        { internalType: "string", name: "_cropType", type: "string" },
        { internalType: "uint256", name: "_quantity", type: "uint256" },
        { internalType: "uint256", name: "_totalPrice", type: "uint256" },
      ],
      name: "createFarmerContract",
      outputs: [{ internalType: "address", name: "", type: "address" }],
      stateMutability: "nonpayable",
      type: "function",
    },
    {
      anonymous: false,
      inputs: [
        { indexed: true, internalType: "address", name: "contractAddress", type: "address" },
        { indexed: true, internalType: "address", name: "farmer", type: "address" },
      ],
      name: "NewFarmerContract",
      type: "event",
    },
    {
      inputs: [{ internalType: "address", name: "_farmer", type: "address" }],
      name: "whitelistFarmer",
      outputs: [],
      stateMutability: "nonpayable",
      type: "function",
    },
    {
      inputs: [{ internalType: "address", name: "_fpo", type: "address" }],
      name: "whitelistFPO",
      outputs: [],
      stateMutability: "nonpayable",
      type: "function",
    },
    {
      inputs: [{ internalType: "address", name: "_retailer", type: "address" }],
      name: "whitelistRetailer",
      outputs: [],
      stateMutability: "nonpayable",
      type: "function",
    },
    {
      inputs: [
        { internalType: "address", name: "_account", type: "address" },
        { internalType: "string", name: "_role", type: "string" },
      ],
      name: "removeFromWhitelist",
      outputs: [],
      stateMutability: "nonpayable",
      type: "function",
    },
    {
      inputs: [{ internalType: "address", name: "_farmer", type: "address" }],
      name: "isFarmerWhitelisted",
      outputs: [{ internalType: "bool", name: "", type: "bool" }],
      stateMutability: "view",
      type: "function",
    },
    {
      inputs: [{ internalType: "address", name: "_fpo", type: "address" }],
      name: "isFPOWhitelisted",
      outputs: [{ internalType: "bool", name: "", type: "bool" }],
      stateMutability: "view",
      type: "function",
    },
    {
      inputs: [{ internalType: "address", name: "_retailer", type: "address" }],
      name: "isRetailerWhitelisted",
      outputs: [{ internalType: "bool", name: "", type: "bool" }],
      stateMutability: "view",
      type: "function",
    },
    {
      inputs: [],
      name: "getDeployedContracts",
      outputs: [{ internalType: "address[]", name: "", type: "address[]" }],
      stateMutability: "view",
      type: "function",
    },
    {
      inputs: [{ internalType: "uint256", name: "", type: "uint256" }],
      name: "deployedContracts",
      outputs: [{ internalType: "address", name: "", type: "address" }],
      stateMutability: "view",
      type: "function",
    },
    {
      inputs: [{ internalType: "address", name: "_contract", type: "address" }],
      name: "getFarmerDetails",
      outputs: [
        { internalType: "string", name: "name", type: "string" },
        { internalType: "string", name: "location", type: "string" },
        { internalType: "string", name: "cropType", type: "string" },
        { internalType: "uint256", name: "quantity", type: "uint256" },
        { internalType: "uint256", name: "totalPrice", type: "uint256" },
        { internalType: "address", name: "wallet", type: "address" },
        { internalType: "bool", name: "isSold", type: "bool" },
      ],
      stateMutability: "view",
      type: "function",
    },
    {
      inputs: [{ internalType: "address", name: "_contract", type: "address" }],
      name: "getFpoDetails",
      outputs: [
        { internalType: "string", name: "name", type: "string" },
        { internalType: "string", name: "location", type: "string" },
        { internalType: "string", name: "agmark", type: "string" },
        { internalType: "string", name: "fssai", type: "string" },
        { internalType: "uint256", name: "agreedPrice", type: "uint256" },
        { internalType: "address", name: "wallet", type: "address" },
        { internalType: "bool", name: "hasPaid", type: "bool" },
      ],
      stateMutability: "view",
      type: "function",
    },
    {
      inputs: [{ internalType: "address", name: "_contract", type: "address" }],
      name: "getRetailerDetails",
      outputs: [
        { internalType: "string", name: "name", type: "string" },
        { internalType: "string", name: "location", type: "string" },
        { internalType: "uint256", name: "agreedPrice", type: "uint256" },
        { internalType: "address", name: "wallet", type: "address" },
        { internalType: "bool", name: "hasPaid", type: "bool" },
      ],
      stateMutability: "view",
      type: "function",
    },
    {
      inputs: [{ internalType: "address", name: "_contract", type: "address" }],
      name: "getContractStatus",
      outputs: [
        { internalType: "bool", name: "funded", type: "bool" },
        { internalType: "bool", name: "released", type: "bool" },
        { internalType: "bool", name: "sold", type: "bool" },
        { internalType: "bool", name: "retailerRegistered", type: "bool" },
        { internalType: "bool", name: "retailerFunded", type: "bool" },
        { internalType: "bool", name: "retailerReleased", type: "bool" },
      ],
      stateMutability: "view",
      type: "function",
    },
    {
      inputs: [],
      name: "getAllFarmers",
      outputs: [
        { internalType: "string[]", name: "names", type: "string[]" },
        { internalType: "address[]", name: "contracts", type: "address[]" },
      ],
      stateMutability: "view",
      type: "function",
    },
    {
      inputs: [],
      name: "getAllFPOs",
      outputs: [
        { internalType: "string[]", name: "names", type: "string[]" },
        { internalType: "address[]", name: "wallets", type: "address[]" },
      ],
      stateMutability: "view",
      type: "function",
    },
    {
      inputs: [],
      name: "getAllRetailers",
      outputs: [
        { internalType: "string[]", name: "names", type: "string[]" },
        { internalType: "address[]", name: "wallets", type: "address[]" },
      ],
      stateMutability: "view",
      type: "function",
    },
    {
      inputs: [{ internalType: "address", name: "_contract", type: "address" }],
      name: "getPriceFlow",
      outputs: [
        { internalType: "uint256", name: "farmerPrice", type: "uint256" },
        { internalType: "uint256", name: "fpoPrice", type: "uint256" },
        { internalType: "uint256", name: "retailerPrice", type: "uint256" },
      ],
      stateMutability: "view",
      type: "function",
    },
  ];

  useEffect(() => {
    axios.defaults.withCredentials = true;
    axios
      .get("/api/did/me/", { withCredentials: true })
      .then((res) => setDidInfo(res.data))
      .catch((err) => console.error("Could not fetch DID:", err));
  }, []);

  const switchToSepolia = async () => {
    if (!window.ethereum) {
      setStatus("MetaMask not found!");
      return;
    }
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: "0xaa36a7" }],
      });
      setStatus("✅ Connected to Sepolia");
    } catch (switchError) {
      if (switchError.code === 4902) {
        try {
          await window.ethereum.request({
            method: "wallet_addEthereumChain",
            params: [
              {
                chainId: "0xaa36a7",
                chainName: "Sepolia Test Network",
                nativeCurrency: { name: "SepoliaETH", symbol: "ETH", decimals: 18 },
                rpcUrls: ["https://rpc.sepolia.org"],
                blockExplorerUrls: ["https://sepolia.etherscan.io"],
              },
            ],
          });
          setStatus("✅ Sepolia added and connected");
        } catch (addError) {
          setStatus("❌ Failed to add Sepolia");
        }
      }
    }
  };

  const getWriteContract = async () => {
    await switchToSepolia();
    const web3Provider = new ethers.providers.Web3Provider(window.ethereum);
    const signer = web3Provider.getSigner();
    return new ethers.Contract(contractAddress, factoryABI, signer);
  };

  const connectWallet = async () => {
    if (!window.ethereum) return setStatus("Install MetaMask!");
    try {
      await switchToSepolia();
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
      const account = accounts[0];
      setWallet(account);

      if (account.toLowerCase() === ADMIN_ADDRESS.toLowerCase()) {
        setStatus("✅ Connected as Protocol Authority Admin (Sepolia)");
      } else {
        setStatus("⚠️ Connected address does not match Admin Authority address");
      }
    } catch (e) {
      setStatus("❌ Wallet connection failed");
    }
  };

  const fetchPending = useCallback(async () => {
    try {
      const res = await axios.get("/api/admin/pending-registrations/", {
        withCredentials: true,
      });
      setPending(res.data || { farmers: [], fpos: [], retailers: [] });
    } catch (err) {
      setStatus("Error fetching pending registrations");
    }
  }, []);

  useEffect(() => {
    fetchPending();
  }, [fetchPending]);

  const handleTx = async (tx, successMsg) => {
    try {
      setLoadingTx(true);
      setStatus(`⏳ Transaction sent: ${tx.hash}`);
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const receipt = await provider.waitForTransaction(tx.hash);
      if (receipt.status === 1) {
        setStatus(`✅ ${successMsg} (Block: ${receipt.blockNumber})`);
        fetchPending();
      } else {
        setStatus("❌ Transaction failed on blockchain");
      }
    } catch (err) {
      setStatus("Error: " + err.message);
    } finally {
      setLoadingTx(false);
    }
  };

  const approve = async (role, id, addr) => {
    try {
      const contract = await getWriteContract();
      let tx;
      if (role === "Farmer") tx = await contract.whitelistFarmer(addr);
      if (role === "FPO") tx = await contract.whitelistFPO(addr);
      if (role === "Retailer") tx = await contract.whitelistRetailer(addr);

      await handleTx(tx, `${role} approved & whitelisted on Sepolia`);

      await axios.post(
        `/api/admin/approve-${role.toLowerCase()}/${id}/`,
        {},
        { withCredentials: true }
      );
      fetchPending();
    } catch (err) {
      setStatus("Error approving " + role + ": " + err.message);
    }
  };

  const reject = async (role, id) => {
    try {
      await axios.post(
        `/api/admin/reject-${role.toLowerCase()}/${id}/`,
        {},
        { withCredentials: true }
      );
      setStatus(`❌ Rejected ${role}`);
      fetchPending();
    } catch (err) {
      setStatus("Error rejecting " + role + ": " + err.message);
    }
  };

  const logout = async () => {
    try {
      await axios.post("/api/token/logout/", {}, { withCredentials: true });
    } catch (err) {
      console.error("Logout error:", err);
    } finally {
      Cookies.remove("access");
      Cookies.remove("refresh");
      Cookies.remove("role");
      navigate("/");
    }
  };

  const totalPending =
    (pending.farmers?.length || 0) +
    (pending.fpos?.length || 0) +
    (pending.retailers?.length || 0);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans">
      {/* ── Top Header ────────────────────────────────────────────── */}
      <header className="bg-slate-800/90 backdrop-blur-md border-b border-slate-700/80 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-xl shadow-lg shadow-blue-500/20 text-white font-bold">
              🛡️
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-white text-lg tracking-tight">
                  FarmerChain
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                  Protocol Governance
                </span>
              </div>
              <p className="text-xs text-slate-400 font-medium">
                Participant Verification & Smart Contract Whitelisting Console
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={logout}
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 hover:text-rose-400 px-3.5 py-2 rounded-xl border border-slate-700 hover:border-rose-500/30 hover:bg-rose-500/10 transition-all cursor-pointer"
          >
            <span>🚪 Logout</span>
          </button>
        </div>
      </header>

      <div className="max-w-6xl mx-auto w-full px-4 sm:px-6 py-6 sm:py-8 flex-1 space-y-6">

        {/* ── Web3 Node & Contract Connectivity Card ────────────────── */}
        <div className="bg-slate-800/80 border border-slate-700/80 rounded-3xl p-6 backdrop-blur-md shadow-xl">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-blue-400">
                  Ethereum Sepolia Whitelist Contract
                </span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                  Live Testnet
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">Contract:</span>
                <AddressCopy value={contractAddress} etherscanType="address" className="text-slate-200" />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">Admin Authority:</span>
                <AddressCopy value={ADMIN_ADDRESS} etherscanType="address" className="text-slate-200" />
              </div>
            </div>

            <button
              type="button"
              onClick={connectWallet}
              className={`px-5 py-3 rounded-2xl text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer shrink-0 ${
                wallet
                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                  : "bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-extrabold shadow-amber-500/20"
              }`}
            >
              <span>🦊</span>
              <span>{wallet ? `Connected: ${wallet.slice(0, 6)}…${wallet.slice(-4)}` : "Connect Admin MetaMask"}</span>
            </button>
          </div>
        </div>

        {/* ── Summary Key Metrics Bar ───────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-4 shadow-xl">
            <div className="flex justify-between items-start">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Pending</span>
              <span className="text-lg">⏳</span>
            </div>
            <p className="text-2xl font-extrabold text-white mt-1 tracking-tight">
              {totalPending}
            </p>
            <p className="text-[11px] text-blue-400 font-semibold mt-0.5">
              Applications Awaiting Audit
            </p>
          </div>

          <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-4 shadow-xl">
            <div className="flex justify-between items-start">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Farmers</span>
              <span className="text-lg">👨‍🌾</span>
            </div>
            <p className="text-2xl font-extrabold text-emerald-400 mt-1 tracking-tight">
              {pending.farmers?.length || 0}
            </p>
            <p className="text-[11px] text-slate-400 font-semibold mt-0.5">
              Agricultural Producers
            </p>
          </div>

          <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-4 shadow-xl">
            <div className="flex justify-between items-start">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">FPOs</span>
              <span className="text-lg">🏢</span>
            </div>
            <p className="text-2xl font-extrabold text-blue-400 mt-1 tracking-tight">
              {pending.fpos?.length || 0}
            </p>
            <p className="text-[11px] text-slate-400 font-semibold mt-0.5">
              Producer Organizations
            </p>
          </div>

          <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-4 shadow-xl">
            <div className="flex justify-between items-start">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Retailers</span>
              <span className="text-lg">🛒</span>
            </div>
            <p className="text-2xl font-extrabold text-purple-400 mt-1 tracking-tight">
              {pending.retailers?.length || 0}
            </p>
            <p className="text-[11px] text-slate-400 font-semibold mt-0.5">
              Commercial Buyers
            </p>
          </div>
        </div>

        {/* ── Admin DID Card ────────────────────────────────────────── */}
        {didInfo && (
          <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-5 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  🔐 Administrator Decentralized Identity (W3C DID)
                </h3>
                <p className="text-xs font-mono text-slate-200 break-all">
                  {didInfo.did}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (!didInfo?.did) return;
                  navigator.clipboard.writeText(didInfo.did).then(() => {
                    setCopyMsg("✅ Copied!");
                    setTimeout(() => setCopyMsg(""), 2000);
                  });
                }}
                className="text-xs bg-slate-700 hover:bg-slate-600 text-slate-200 px-3.5 py-2 rounded-xl border border-slate-600 transition-all cursor-pointer self-start sm:self-auto shrink-0 font-semibold"
              >
                {copyMsg || "📋 Copy Admin DID"}
              </button>
            </div>
          </div>
        )}

        {/* ── Live Status Toast ─────────────────────────────────────── */}
        {status && (
          <div className="p-3.5 rounded-2xl text-xs font-semibold bg-blue-500/10 border border-blue-500/30 text-blue-300 text-center animate-fade-in">
            {status}
          </div>
        )}

        {/* ── Segmented Navigation Filter ───────────────────────────── */}
        <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-1.5 shadow-xl flex flex-wrap gap-1">
          <button
            type="button"
            className={`flex-1 min-w-[120px] py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === "all"
                ? "bg-blue-600 text-white shadow-sm"
                : "text-slate-400 hover:text-white hover:bg-slate-700/50"
            }`}
            onClick={() => setActiveTab("all")}
          >
            <span>All Pending ({totalPending})</span>
          </button>

          <button
            type="button"
            className={`flex-1 min-w-[120px] py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === "farmers"
                ? "bg-emerald-600 text-white shadow-sm"
                : "text-slate-400 hover:text-white hover:bg-slate-700/50"
            }`}
            onClick={() => setActiveTab("farmers")}
          >
            <span>👨‍🌾 Farmers ({pending.farmers?.length || 0})</span>
          </button>

          <button
            type="button"
            className={`flex-1 min-w-[120px] py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === "fpos"
                ? "bg-blue-600 text-white shadow-sm"
                : "text-slate-400 hover:text-white hover:bg-slate-700/50"
            }`}
            onClick={() => setActiveTab("fpos")}
          >
            <span>🏢 FPOs ({pending.fpos?.length || 0})</span>
          </button>

          <button
            type="button"
            className={`flex-1 min-w-[120px] py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === "retailers"
                ? "bg-purple-600 text-white shadow-sm"
                : "text-slate-400 hover:text-white hover:bg-slate-700/50"
            }`}
            onClick={() => setActiveTab("retailers")}
          >
            <span>🛒 Retailers ({pending.retailers?.length || 0})</span>
          </button>
        </div>

        {/* ── Pending Farmers List ──────────────────────────────────── */}
        {(activeTab === "all" || activeTab === "farmers") && (
          <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-700">
              <h3 className="text-sm font-extrabold text-emerald-400 uppercase tracking-wider flex items-center gap-2">
                <span>👨‍🌾</span> Pending Farmer Approvals ({pending.farmers?.length || 0})
              </h3>
            </div>

            {pending.farmers?.length === 0 ? (
              <div className="py-6 text-center text-slate-500 text-xs">
                No pending farmer applications.
              </div>
            ) : (
              <div className="space-y-3">
                {pending.farmers.map((f) => (
                  <div
                    key={f.id}
                    className="bg-slate-900/70 border border-slate-700/80 hover:border-emerald-500/40 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 transition-all"
                  >
                    <div className="space-y-1">
                      <p className="text-sm font-bold text-white">
                        {f.name} <span className="text-xs font-normal text-slate-400">({f.email})</span>
                      </p>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-slate-400">Wallet:</span>
                        <AddressCopy value={f.wallet_address} etherscanType="address" className="text-slate-300 font-mono" />
                      </div>
                    </div>

                    <div className="flex gap-2 shrink-0">
                      <button
                        type="button"
                        disabled={loadingTx}
                        onClick={() => approve("Farmer", f.id, f.wallet_address)}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-4 py-2 rounded-xl transition-all shadow-md shadow-emerald-900/30 disabled:opacity-50 cursor-pointer"
                      >
                        ✓ Approve & Whitelist
                      </button>
                      <button
                        type="button"
                        onClick={() => reject("Farmer", f.id)}
                        className="bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-600/30 text-xs font-bold px-4 py-2 rounded-xl transition-all cursor-pointer"
                      >
                        ✕ Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Pending FPOs List ─────────────────────────────────────── */}
        {(activeTab === "all" || activeTab === "fpos") && (
          <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-700">
              <h3 className="text-sm font-extrabold text-blue-400 uppercase tracking-wider flex items-center gap-2">
                <span>🏢</span> Pending FPO Approvals ({pending.fpos?.length || 0})
              </h3>
            </div>

            {pending.fpos?.length === 0 ? (
              <div className="py-6 text-center text-slate-500 text-xs">
                No pending FPO applications.
              </div>
            ) : (
              <div className="space-y-3">
                {pending.fpos.map((f) => (
                  <div
                    key={f.id}
                    className="bg-slate-900/70 border border-slate-700/80 hover:border-blue-500/40 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 transition-all"
                  >
                    <div className="space-y-1">
                      <p className="text-sm font-bold text-white">
                        {f.name} <span className="text-xs font-normal text-slate-400">({f.email})</span>
                      </p>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-slate-400">Wallet:</span>
                        <AddressCopy value={f.wallet_address} etherscanType="address" className="text-slate-300 font-mono" />
                      </div>
                    </div>

                    <div className="flex gap-2 shrink-0">
                      <button
                        type="button"
                        disabled={loadingTx}
                        onClick={() => approve("FPO", f.id, f.wallet_address)}
                        className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-4 py-2 rounded-xl transition-all shadow-md shadow-blue-900/30 disabled:opacity-50 cursor-pointer"
                      >
                        ✓ Approve & Whitelist
                      </button>
                      <button
                        type="button"
                        onClick={() => reject("FPO", f.id)}
                        className="bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-600/30 text-xs font-bold px-4 py-2 rounded-xl transition-all cursor-pointer"
                      >
                        ✕ Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Pending Retailers List ────────────────────────────────── */}
        {(activeTab === "all" || activeTab === "retailers") && (
          <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-700">
              <h3 className="text-sm font-extrabold text-purple-400 uppercase tracking-wider flex items-center gap-2">
                <span>🛒</span> Pending Retailer Approvals ({pending.retailers?.length || 0})
              </h3>
            </div>

            {pending.retailers?.length === 0 ? (
              <div className="py-6 text-center text-slate-500 text-xs">
                No pending retailer applications.
              </div>
            ) : (
              <div className="space-y-3">
                {pending.retailers.map((r) => (
                  <div
                    key={r.id}
                    className="bg-slate-900/70 border border-slate-700/80 hover:border-purple-500/40 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 transition-all"
                  >
                    <div className="space-y-1">
                      <p className="text-sm font-bold text-white">
                        {r.name} <span className="text-xs font-normal text-slate-400">({r.email})</span>
                      </p>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-slate-400">Wallet:</span>
                        <AddressCopy value={r.wallet_address} etherscanType="address" className="text-slate-300 font-mono" />
                      </div>
                    </div>

                    <div className="flex gap-2 shrink-0">
                      <button
                        type="button"
                        disabled={loadingTx}
                        onClick={() => approve("Retailer", r.id, r.wallet_address)}
                        className="bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold px-4 py-2 rounded-xl transition-all shadow-md shadow-purple-900/30 disabled:opacity-50 cursor-pointer"
                      >
                        ✓ Approve & Whitelist
                      </button>
                      <button
                        type="button"
                        onClick={() => reject("Retailer", r.id)}
                        className="bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-600/30 text-xs font-bold px-4 py-2 rounded-xl transition-all cursor-pointer"
                      >
                        ✕ Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
