import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { ethers } from "ethers";
import EscrowABI from "../../utils/EscrowABI.json";

const ESCROW_CONTRACT = import.meta.env.VITE_ESCROW_CONTRACT_ADDRESS;
const SEPOLIA_CHAIN_ID = "0xaa36a7"; // 11155111

const STATUS_LABELS = {
  created: "⏳ Awaiting Funding",
  funded: "💰 Funded",
  delivery_confirmed: "📦 Delivery Confirmed",
  released: "✅ Released",
  cancelled: "❌ Cancelled",
  disputed: "⚠️ Disputed",
};

const STATUS_COLORS = {
  created: "bg-yellow-100 text-yellow-800",
  funded: "bg-blue-100 text-blue-800",
  delivery_confirmed: "bg-purple-100 text-purple-800",
  released: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
  disputed: "bg-orange-100 text-orange-800",
};

export default function FpoEscrowPanel() {
  const [escrows, setEscrows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [txStatus, setTxStatus] = useState({});

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

  // ── Helpers ─────────────────────────────────────────────────────

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
        throw new Error("Please switch MetaMask to Sepolia Test Network.");
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

      if (!escrow.escrow_id) throw new Error("On-chain escrow ID missing. Farmer needs to create on-chain escrow first.");

      const { signer, contract } = await getSignerAndContract();

      // Verify FPO wallet matches
      const signerAddr = await signer.getAddress();
      if (signerAddr.toLowerCase() !== escrow.fpo_wallet?.toLowerCase()) {
        throw new Error(
          `Wallet mismatch. Expected ${escrow.fpo_wallet}, got ${signerAddr}. ` +
          "Switch to the correct MetaMask account."
        );
      }

      const amountWei = ethers.utils.parseEther(String(escrow.amount_eth));

      setTx(key, { loading: true, success: "Sending deposit via MetaMask..." });
      const tx = await contract.depositEscrow(escrow.escrow_id, { value: amountWei });

      setTx(key, { loading: true, success: "Waiting for confirmation..." });
      const receipt = await tx.wait();

      // Record in backend
      await axios.post(
        `/api/escrow/${escrow.id}/funded/`,
        { tx_hash: receipt.transactionHash },
        { withCredentials: true }
      );

      setTx(key, { loading: false, success: "Escrow funded! ✅" });
      await fetchEscrows();
    } catch (err) {
      console.error("Fund escrow error:", err);
      let msg = err.response?.data?.error || err.reason || err.message || "Failed to fund escrow.";
      // User rejected MetaMask
      if (err.code === 4001 || err.code === "ACTION_REJECTED") {
        msg = "Transaction rejected in MetaMask.";
      }
      setTx(key, { loading: false, error: msg });
    }
  };

  // ── Release Payment ─────────────────────────────────────────────

  const releasePayment = async (escrow) => {
    const key = `release-${escrow.id}`;
    try {
      setTx(key, { loading: true, error: null, success: null });

      if (!escrow.escrow_id) throw new Error("On-chain escrow ID missing.");

      const { signer, contract } = await getSignerAndContract();

      // Verify FPO wallet
      const signerAddr = await signer.getAddress();
      if (signerAddr.toLowerCase() !== escrow.fpo_wallet?.toLowerCase()) {
        throw new Error(
          `Wallet mismatch. Expected ${escrow.fpo_wallet}, got ${signerAddr}.`
        );
      }

      setTx(key, { loading: true, success: "Releasing payment via MetaMask..." });
      const tx = await contract.releasePayment(escrow.escrow_id);

      setTx(key, { loading: true, success: "Waiting for confirmation..." });
      const receipt = await tx.wait();

      // Record in backend
      await axios.post(
        `/api/escrow/${escrow.id}/released/`,
        { tx_hash: receipt.transactionHash },
        { withCredentials: true }
      );

      setTx(key, { loading: false, success: "Payment released to farmer! ✅" });
      await fetchEscrows();
    } catch (err) {
      console.error("Release payment error:", err);
      let msg = err.response?.data?.error || err.reason || err.message || "Failed to release payment.";
      if (err.code === 4001 || err.code === "ACTION_REJECTED") {
        msg = "Transaction rejected in MetaMask.";
      }
      setTx(key, { loading: false, error: msg });
    }
  };

  // ── Render ──────────────────────────────────────────────────────

  if (loading) return <p className="text-gray-500 text-sm">Loading escrows…</p>;

  if (escrows.length === 0) {
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-8 text-center">
        <p className="text-blue-700 font-medium">No escrow transactions yet.</p>
        <p className="text-gray-500 text-sm mt-1">
          When a farmer creates an escrow for your accepted bid, it will appear here.
        </p>
      </div>
    );
  }

  return (
    <div>
      {escrows.map((escrow) => {
        const fundKey = `fund-${escrow.id}`;
        const releaseKey = `release-${escrow.id}`;
        const fundTx = txStatus[fundKey] || {};
        const releaseTx = txStatus[releaseKey] || {};

        return (
          <div
            key={escrow.id}
            className="bg-white border border-gray-200 rounded-xl p-5 mb-4 shadow-sm"
          >
            {/* Header */}
            <div className="flex justify-between items-center mb-3">
              <h4 className="font-semibold text-gray-800">
                🔐 Escrow #{escrow.escrow_id || escrow.id}
              </h4>
              <span
                className={`px-3 py-1 rounded-full text-xs font-semibold ${
                  STATUS_COLORS[escrow.status] || "bg-gray-100 text-gray-700"
                }`}
              >
                {STATUS_LABELS[escrow.status] || escrow.status}
              </span>
            </div>

            {/* Details */}
            <div className="grid grid-cols-2 gap-2 text-sm text-gray-600 mb-3">
              <p>
                <span className="font-medium text-gray-500">Product:</span>{" "}
                {escrow.product_name}
              </p>
              <p>
                <span className="font-medium text-gray-500">Farmer:</span>{" "}
                {escrow.farmer_name}
              </p>
              <p>
                <span className="font-medium text-gray-500">Amount:</span>{" "}
                {escrow.amount_eth} ETH
              </p>
              <p>
                <span className="font-medium text-gray-500">Quantity:</span>{" "}
                {escrow.quantity} {escrow.unit}
              </p>
            </div>

            {/* Contract address */}
            {escrow.contract_address && (
              <p className="text-xs text-gray-500 mb-2 break-all">
                Contract:{" "}
                <a
                  href={escrow.etherscan_contract_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  {escrow.contract_address}
                </a>
              </p>
            )}

            {/* Tx hashes */}
            {escrow.deposit_tx_hash && (
              <p className="text-xs text-gray-500 mb-1 break-all">
                Deposit Tx:{" "}
                <a
                  href={escrow.etherscan_deposit_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  {escrow.deposit_tx_hash}
                </a>
              </p>
            )}
            {escrow.release_tx_hash && (
              <p className="text-xs text-gray-500 mb-1 break-all">
                Release Tx:{" "}
                <a
                  href={escrow.etherscan_release_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  {escrow.release_tx_hash}
                </a>
              </p>
            )}

            {/* Fund Escrow button */}
            {escrow.status === "created" && (
              <div className="mt-3">
                <button
                  onClick={() => fundEscrow(escrow)}
                  disabled={fundTx.loading}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold text-white ${
                    fundTx.loading
                      ? "bg-gray-400 cursor-not-allowed"
                      : "bg-blue-600 hover:bg-blue-700"
                  }`}
                >
                  {fundTx.loading ? "⏳ Processing..." : "💰 Fund Escrow"}
                </button>
                {fundTx.success && (
                  <p className="text-sm text-green-600 mt-2">{fundTx.success}</p>
                )}
                {fundTx.error && (
                  <p className="text-sm text-red-600 mt-2">❌ {fundTx.error}</p>
                )}
              </div>
            )}

            {/* Release Payment button */}
            {escrow.status === "delivery_confirmed" && (
              <div className="mt-3">
                <button
                  onClick={() => releasePayment(escrow)}
                  disabled={releaseTx.loading}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold text-white ${
                    releaseTx.loading
                      ? "bg-gray-400 cursor-not-allowed"
                      : "bg-green-600 hover:bg-green-700"
                  }`}
                >
                  {releaseTx.loading ? "⏳ Processing..." : "✅ Release Payment"}
                </button>
                {releaseTx.success && (
                  <p className="text-sm text-green-600 mt-2">{releaseTx.success}</p>
                )}
                {releaseTx.error && (
                  <p className="text-sm text-red-600 mt-2">❌ {releaseTx.error}</p>
                )}
              </div>
            )}

            {/* Status timeline */}
            <div className="mt-3 text-xs text-gray-400 space-y-1">
              <p>Created: {new Date(escrow.created_at).toLocaleString()}</p>
              {escrow.funded_at && (
                <p>Funded: {new Date(escrow.funded_at).toLocaleString()}</p>
              )}
              {escrow.delivery_confirmed_at && (
                <p>
                  Delivery Confirmed:{" "}
                  {new Date(escrow.delivery_confirmed_at).toLocaleString()}
                </p>
              )}
              {escrow.released_at && (
                <p>Released: {new Date(escrow.released_at).toLocaleString()}</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
