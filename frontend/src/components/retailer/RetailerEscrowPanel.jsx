import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { ethers } from "ethers";
import { useRefresh, useRefreshSubscription } from "../../context/useRefresh";
import EscrowABI from "../../utils/EscrowABI.json";
import EscrowDealCard from "../common/EscrowDealCard";
import EscrowDealModal from "../common/EscrowDealModal";

const ESCROW_CONTRACT = __ENV_ESCROW_CONTRACT_ADDRESS__;
const SEPOLIA_CHAIN_ID = "0xaa36a7"; // 11155111

export default function RetailerEscrowPanel({ onPaymentReleased, onEscrowUpdated }) {
  const { refresh } = useRefresh();
  const [escrows, setEscrows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [txStatus, setTxStatus] = useState({});
  const [activeModalEscrow, setActiveModalEscrow] = useState(null);

  const fetchEscrows = useCallback(async () => {
    try {
      const res = await axios.get("/api/escrow/retailer/my/", { withCredentials: true });
      setEscrows(res.data.escrows || []);
    } catch (err) {
      console.error("Error fetching retailer escrows:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEscrows();
  }, [fetchEscrows]);

  useRefreshSubscription(["escrow", "deals", "quotes", "retailer", "fpo"], fetchEscrows);

  const ensureSepolia = async () => {
    if (!window.ethereum) throw new Error("MetaMask is required.");
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

  const getContract = async () => {
    if (!ESCROW_CONTRACT) throw new Error("Escrow contract address is not configured.");
    await ensureSepolia();
    const provider = new ethers.providers.Web3Provider(window.ethereum);
    await provider.send("eth_requestAccounts", []);
    const signer = provider.getSigner();
    return new ethers.Contract(ESCROW_CONTRACT, EscrowABI, signer);
  };

  const setTx = (id, update) =>
    setTxStatus((prev) => ({ ...prev, [id]: { ...(prev[id] || {}), ...update } }));

  // ── Fund Escrow ─────────────────────────────────────────────────
  const handleFundEscrow = async (escrow) => {
    const key = `fund-${escrow.id}`;
    try {
      setTx(key, { loading: true, error: null, success: null });

      if (!escrow.escrow_id) {
        throw new Error("On-chain escrow ID missing. FPO must initialize the agreement first.");
      }

      const contract = await getContract();
      const amountWei = ethers.utils.parseEther(String(escrow.amount_eth));

      setTx(key, { loading: true, success: `Sending deposit of ${escrow.amount_eth} ETH via MetaMask…` });
      const tx = await contract.depositEscrow(escrow.escrow_id, { value: amountWei });

      setTx(key, { loading: true, success: "Waiting for Sepolia blockchain confirmation…" });
      const receipt = await tx.wait();

      await axios.post(
        `/api/escrow/retailer/${escrow.id}/funded/`,
        { tx_hash: receipt.transactionHash, escrow_id: escrow.escrow_id },
        { withCredentials: true }
      );

      setTx(key, { loading: false, success: `Escrow funded with ${escrow.amount_eth} ETH on Sepolia! ✅` });
      await fetchEscrows();
      if (onEscrowUpdated) onEscrowUpdated();
      refresh(["escrow", "deals", "quotes", "retailer", "fpo"]);
    } catch (err) {
      console.error("Fund retailer escrow error:", err);
      let msg = err.response?.data?.error || err.reason || err.message || "Failed to fund escrow.";
      if (err.code === 4001 || err.code === "ACTION_REJECTED") {
        msg = "Deposit transaction was rejected in MetaMask.";
      }
      setTx(key, { loading: false, error: msg });
    }
  };

  // ── Release Payment ─────────────────────────────────────────────
  const handleReleasePayment = async (escrow) => {
    const key = `release-${escrow.id}`;
    try {
      setTx(key, { loading: true, error: null, success: null });

      if (!escrow.escrow_id) throw new Error("On-chain escrow ID missing.");

      const contract = await getContract();
      setTx(key, { loading: true, success: "Releasing funds to FPO via MetaMask…" });

      const tx = await contract.releasePayment(escrow.escrow_id);
      setTx(key, { loading: true, success: "Waiting for Sepolia blockchain confirmation…" });
      const receipt = await tx.wait();

      await axios.post(
        `/api/escrow/retailer/${escrow.id}/released/`,
        { tx_hash: receipt.transactionHash },
        { withCredentials: true }
      );

      setTx(key, { loading: false, success: "Payment released to FPO! Stock added to your Inventory ✅" });
      await fetchEscrows();
      if (onEscrowUpdated) onEscrowUpdated();
      if (onPaymentReleased) onPaymentReleased();
      refresh(["escrow", "deals", "quotes", "retailer", "fpo", "inventory"]);
    } catch (err) {
      console.error("Release retailer payment error:", err);
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
        <p className="text-sm font-bold text-slate-800">No Commercial Escrows Active</p>
        <p className="text-xs text-slate-400 max-w-sm mx-auto">
          When an FPO accepts your wholesale procurement bid, the on-chain escrow transaction will appear here for payment lock and release.
        </p>
      </div>
    );
  }

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
          onClick={() => handleFundEscrow(escrow)}
          disabled={fundTx.loading || !escrow.escrow_id}
          className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50 text-xs"
        >
          <span>💰</span>
          <span>{fundTx.loading ? "Locking Funds…" : `Lock ${escrow.amount_eth} ETH in Escrow (MetaMask)`}</span>
        </button>
      );
    }

    if (escrow.status === "delivery_confirmed") {
      return (
        <button
          type="button"
          onClick={() => handleReleasePayment(escrow)}
          disabled={releaseTx.loading}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50 text-xs"
        >
          <span>💸</span>
          <span>{releaseTx.loading ? "Releasing…" : "Confirm Delivery & Release Payment (MetaMask)"}</span>
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
            requiredAction = escrow.escrow_id ? "Lock ETH Funds" : "Awaiting FPO Setup";
          } else if (escrow.status === "funded") {
            requiredAction = "Awaiting Delivery Handover";
          } else if (escrow.status === "delivery_confirmed") {
            requiredAction = "Release Payment to FPO";
          }

          return (
            <EscrowDealCard
              key={escrow.id}
              escrow={escrow}
              partnerLabel="FPO Supplier"
              partnerName={escrow.fpo_name}
              requiredActionLabel={requiredAction}
              onViewDeal={(esc) => setActiveModalEscrow(esc)}
              isRetailer={true}
            />
          );
        })}
      </div>

      {activeModalEscrow && (
        <EscrowDealModal
          isOpen={Boolean(activeModalEscrow)}
          onClose={() => setActiveModalEscrow(null)}
          escrow={activeModalEscrow}
          partnerLabel="FPO Supplier"
          partnerName={activeModalEscrow.fpo_name}
          actionButton={renderModalAction(activeModalEscrow)}
          actionStatus={getModalActionStatus(activeModalEscrow)}
        />
      )}
    </div>
  );
}
