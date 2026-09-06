import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { ethers } from "ethers";
import { useRefresh, useRefreshSubscription } from "../../context/useRefresh";
import EscrowABI from "../../utils/EscrowABI.json";
import EscrowDealCard from "../common/EscrowDealCard";
import EscrowDealModal from "../common/EscrowDealModal";

const ESCROW_CONTRACT = __ENV_ESCROW_CONTRACT_ADDRESS__;
const SEPOLIA_CHAIN_ID = "0xaa36a7"; // 11155111

export default function FpoEscrowPanel({ onEscrowUpdated }) {
  const { refresh } = useRefresh();
  const [escrows, setEscrows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [txStatus, setTxStatus] = useState({});
  const [activeModalEscrow, setActiveModalEscrow] = useState(null);

  const fetchEscrows = useCallback(async () => {
    try {
      const res = await axios.get("/api/escrow/my/", { withCredentials: true });
      setEscrows(res.data.escrows || []);
    } catch (err) {
      console.error("Error fetching escrows:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEscrows();
  }, [fetchEscrows]);

  useRefreshSubscription(["escrow", "deals", "quotes", "fpo", "farmer"], fetchEscrows);

  const ensureSepolia = async () => {
    if (!window.ethereum) throw new Error("MetaMask is not installed.");
    const chainId = await window.ethereum.request({ method: "eth_chainId" });
    if (chainId !== SEPOLIA_CHAIN_ID) {
      try {
        await window.ethereum.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: SEPOLIA_CHAIN_ID }],
        });
      } catch {
        throw new Error("Please switch MetaMask network to Ethereum Sepolia Testnet.");
      }
    }
  };

  const getSignerAndContract = async () => {
    if (!ESCROW_CONTRACT) throw new Error("Escrow contract address not configured.");
    await ensureSepolia();
    const provider = new ethers.providers.Web3Provider(window.ethereum);
    await provider.send("eth_requestAccounts", []);
    const signer = provider.getSigner();
    const contract = new ethers.Contract(ESCROW_CONTRACT, EscrowABI, signer);
    return { signer, contract };
  };

  const setTx = (id, update) =>
    setTxStatus((prev) => ({ ...prev, [id]: { ...(prev[id] || {}), ...update } }));

  // ── Fund Escrow ─────────────────────────────────────────────────
  const fundEscrow = async (escrow) => {
    const key = `fund-${escrow.id}`;
    try {
      setTx(key, { loading: true, error: null, success: null });

      if (!escrow.escrow_id) {
        throw new Error("Blockchain escrow not created yet. The farmer must complete the initial MetaMask escrow registration.");
      }

      const amountNum = parseFloat(escrow.amount_eth);
      if (isNaN(amountNum) || amountNum <= 0) {
        throw new Error(`Invalid escrow amount: ${escrow.amount_eth} ETH.`);
      }

      const { signer, contract } = await getSignerAndContract();
      const signerAddr = await signer.getAddress();
      if (signerAddr.toLowerCase() !== escrow.fpo_wallet?.toLowerCase()) {
        throw new Error(
          `Wallet mismatch: Connected wallet is ${signerAddr}, but this escrow requires FPO wallet ${escrow.fpo_wallet}.`
        );
      }

      const amountWei = ethers.utils.parseEther(String(escrow.amount_eth));
      setTx(key, { loading: true, success: `Sending deposit of ${escrow.amount_eth} ETH via MetaMask…` });
      const tx = await contract.depositEscrow(escrow.escrow_id, { value: amountWei });

      setTx(key, { loading: true, success: "Waiting for Sepolia blockchain confirmation…" });
      const receipt = await tx.wait();

      await axios.post(
        `/api/escrow/${escrow.id}/funded/`,
        { tx_hash: receipt.transactionHash, escrow_id: escrow.escrow_id },
        { withCredentials: true }
      );

      setTx(key, { loading: false, success: `Escrow #${escrow.escrow_id} funded with ${escrow.amount_eth} ETH on Sepolia! ✅` });
      await fetchEscrows();
      if (onEscrowUpdated) onEscrowUpdated();
      refresh(["escrow", "deals", "quotes", "fpo", "farmer"]);
    } catch (err) {
      console.error("Fund escrow error:", err);
      let msg = err.response?.data?.error || err.reason || err.message || "Failed to fund escrow.";
      if (err.code === 4001 || err.code === "ACTION_REJECTED") {
        msg = "Deposit transaction was rejected in MetaMask.";
      }
      setTx(key, { loading: false, error: msg });
    }
  };

  // ── Release Payment ─────────────────────────────────────────────
  const releasePayment = async (escrow) => {
    const key = `release-${escrow.id}`;
    try {
      setTx(key, { loading: true, error: null, success: null });

      if (!escrow.escrow_id) {
        throw new Error("On-chain escrow ID missing.");
      }

      const { signer, contract } = await getSignerAndContract();
      const signerAddr = await signer.getAddress();
      if (signerAddr.toLowerCase() !== escrow.fpo_wallet?.toLowerCase()) {
        throw new Error(
          `Wallet mismatch: Connected wallet is ${signerAddr}, but this escrow requires FPO wallet ${escrow.fpo_wallet}.`
        );
      }

      setTx(key, { loading: true, success: "Releasing funds via MetaMask…" });
      const tx = await contract.releasePayment(escrow.escrow_id);

      setTx(key, { loading: true, success: "Waiting for Sepolia blockchain confirmation…" });
      const receipt = await tx.wait();

      await axios.post(
        `/api/escrow/${escrow.id}/released/`,
        { tx_hash: receipt.transactionHash },
        { withCredentials: true }
      );

      setTx(key, { loading: false, success: "Payment released to Farmer on Sepolia! ✅" });
      await fetchEscrows();
      if (onEscrowUpdated) onEscrowUpdated();
      refresh(["escrow", "deals", "quotes", "fpo", "farmer", "inventory", "transactions"]);
    } catch (err) {
      console.error("Release payment error:", err);
      let msg = err.response?.data?.error || err.reason || err.message || "Failed to release payment.";
      if (err.code === 4001 || err.code === "ACTION_REJECTED") {
        msg = "Release transaction was rejected in MetaMask.";
      }
      setTx(key, { loading: false, error: msg });
    }
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2].map((i) => (
          <div key={i} className="bg-slate-50 border border-slate-200/60 rounded-2xl p-5 animate-pulse space-y-2">
            <div className="h-4 bg-slate-200 rounded w-1/4"></div>
            <div className="h-10 bg-slate-200 rounded"></div>
          </div>
        ))}
      </div>
    );
  }

  if (escrows.length === 0) {
    return (
      <div className="py-12 text-center bg-slate-50/50 rounded-2xl border border-slate-100 space-y-2">
        <span className="text-4xl block mb-2">🔐</span>
        <p className="text-sm font-bold text-slate-800">No Farmer Procurement Escrows Available</p>
        <p className="text-xs text-slate-400 max-w-sm mx-auto">
          When farmers accept your procurement bids and initialize escrows on Sepolia, deals will appear here for payment deposit and release.
        </p>
      </div>
    );
  }

  // Derive action button for active modal escrow
  const renderModalAction = (escrow) => {
    if (!escrow) return null;
    const fundKey = `fund-${escrow.id}`;
    const releaseKey = `release-${escrow.id}`;
    const fundTx = txStatus[fundKey] || {};
    const releaseTx = txStatus[releaseKey] || {};

    if (escrow.status === "created") {
      return (
        <button
          type="button"
          onClick={() => fundEscrow(escrow)}
          disabled={fundTx.loading || !escrow.escrow_id}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50 text-xs"
        >
          <span>💰</span>
          <span>{fundTx.loading ? "Depositing ETH…" : `Deposit ${escrow.amount_eth} ETH via MetaMask`}</span>
        </button>
      );
    }

    if (escrow.status === "delivery_confirmed") {
      return (
        <button
          type="button"
          onClick={() => releasePayment(escrow)}
          disabled={releaseTx.loading}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50 text-xs"
        >
          <span>💸</span>
          <span>{releaseTx.loading ? "Releasing Payment…" : "Release Payment to Farmer"}</span>
        </button>
      );
    }

    return null;
  };

  const getModalActionStatus = (escrow) => {
    if (!escrow) return null;
    return txStatus[`fund-${escrow.id}`] || txStatus[`release-${escrow.id}`] || null;
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        {escrows.map((escrow) => {
          let requiredAction = null;
          if (escrow.status === "created") {
            requiredAction = escrow.escrow_id ? "Deposit Funds (MetaMask)" : "Awaiting Farmer On-Chain ID";
          } else if (escrow.status === "delivery_confirmed") {
            requiredAction = "Release Payment to Farmer";
          } else if (escrow.status === "funded") {
            requiredAction = "Awaiting Handover";
          }

          return (
            <EscrowDealCard
              key={escrow.id}
              escrow={escrow}
              partnerLabel="Farmer Supplier"
              partnerName={escrow.farmer_name}
              requiredActionLabel={requiredAction}
              onViewDeal={(esc) => setActiveModalEscrow(esc)}
            />
          );
        })}
      </div>

      {/* ── Escrow Deal Detail Modal ───────────────────────────────── */}
      {activeModalEscrow && (
        <EscrowDealModal
          isOpen={Boolean(activeModalEscrow)}
          onClose={() => setActiveModalEscrow(null)}
          escrow={activeModalEscrow}
          partnerLabel="Farmer Supplier"
          partnerName={activeModalEscrow.farmer_name}
          actionButton={renderModalAction(activeModalEscrow)}
          actionStatus={getModalActionStatus(activeModalEscrow)}
        />
      )}
    </div>
  );
}
