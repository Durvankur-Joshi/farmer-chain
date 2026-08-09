import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { ethers } from "ethers";
import EscrowABI from "../../utils/EscrowABI.json";

const ESCROW_CONTRACT = import.meta.env.VITE_ESCROW_CONTRACT_ADDRESS;
const SEPOLIA_CHAIN_ID = "0xaa36a7"; // 11155111 in hex

const STATUS_LABELS = {
  created: "⏳ Created",
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

export default function EscrowPanel() {
  const [escrows, setEscrows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [txStatus, setTxStatus] = useState({});

  // Accepted quotes without escrows
  const [acceptedQuotes, setAcceptedQuotes] = useState([]);

  const fetchEscrows = useCallback(async () => {
    try {
      const res = await axios.get("/api/escrow/my/", { withCredentials: true });
      setEscrows(res.data.escrows || []);
    } catch (err) {
      console.error("Error fetching escrows:", err);
    }
  }, []);

  const fetchAcceptedQuotes = useCallback(async () => {
    try {
      const res = await axios.get("/api/farmer/quotes/", { withCredentials: true });
      const quotes = res.data || [];
      // A quote is eligible for escrow if it has an accepted_bid (truthy PK).
      // The status may be "accepted", "awarded", or "contract_created" depending
      // on which workflow path was used. We rely on accepted_bid presence instead.
      const accepted = quotes.filter(
        (q) => q.accepted_bid && q.status !== "open"
      );
      setAcceptedQuotes(accepted);
    } catch (err) {
      console.error("Error fetching quotes:", err);
    }
  }, []);

  useEffect(() => {
    Promise.all([fetchEscrows(), fetchAcceptedQuotes()]).finally(() =>
      setLoading(false)
    );
  }, [fetchEscrows, fetchAcceptedQuotes]);

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

  const getContract = async () => {
    if (!ESCROW_CONTRACT) throw new Error("Escrow contract address not configured.");
    await ensureSepolia();
    const provider = new ethers.providers.Web3Provider(window.ethereum);
    await provider.send("eth_requestAccounts", []);
    const signer = provider.getSigner();
    return new ethers.Contract(ESCROW_CONTRACT, EscrowABI, signer);
  };

  const setTx = (id, update) =>
    setTxStatus((prev) => ({ ...prev, [id]: { ...(prev[id] || {}), ...update } }));

  // ── Create Escrow ───────────────────────────────────────────────

  const createEscrow = async (quote) => {
    const key = `create-${quote.id}`;
    try {
      setTx(key, { loading: true, error: null, success: null });

      // Step 1: Create escrow record in backend
      const res = await axios.post(
        "/api/escrow/create/",
        { quote_id: quote.id },
        { withCredentials: true }
      );
      const escrowData = res.data.escrow;
      const amountWei = ethers.utils.parseEther(String(res.data.amount_eth));
      const fpoWallet = res.data.fpo_wallet;

      setTx(key, { loading: true, error: null, success: "Creating on-chain escrow..." });

      // Step 2: Create on-chain escrow via MetaMask
      const contract = await getContract();
      const tx = await contract.createEscrow(fpoWallet, amountWei, quote.id);

      setTx(key, { loading: true, success: "Waiting for confirmation..." });
      const receipt = await tx.wait();

      // Extract escrow ID from EscrowCreated event
      const event = receipt.events?.find((e) => e.event === "EscrowCreated");
      const onChainId = event ? event.args.escrowId.toNumber() : null;

      // Step 3: Record on-chain tx in backend
      await axios.post(
        `/api/escrow/${escrowData.id}/created-onchain/`,
        { tx_hash: receipt.transactionHash, escrow_id: onChainId },
        { withCredentials: true }
      );

      setTx(key, { loading: false, success: "Escrow created on blockchain! ✅" });
      await Promise.all([fetchEscrows(), fetchAcceptedQuotes()]);
    } catch (err) {
      console.error("Create escrow error:", err);
      const msg =
        err.response?.data?.error ||
        err.reason ||
        err.message ||
        "Failed to create escrow.";
      setTx(key, { loading: false, error: msg });
    }
  };

  // ── Confirm Delivery ────────────────────────────────────────────

  const confirmDelivery = async (escrow) => {
    const key = `delivery-${escrow.id}`;
    try {
      setTx(key, { loading: true, error: null, success: null });

      if (!escrow.escrow_id) throw new Error("On-chain escrow ID missing.");

      const contract = await getContract();
      setTx(key, { loading: true, success: "Confirming delivery via MetaMask..." });

      const tx = await contract.confirmDelivery(escrow.escrow_id);
      setTx(key, { loading: true, success: "Waiting for confirmation..." });
      const receipt = await tx.wait();

      // Record in backend
      await axios.post(
        `/api/escrow/${escrow.id}/delivery-confirm/`,
        { tx_hash: receipt.transactionHash },
        { withCredentials: true }
      );

      setTx(key, { loading: false, success: "Delivery confirmed! ✅" });
      await fetchEscrows();
    } catch (err) {
      console.error("Confirm delivery error:", err);
      const msg =
        err.response?.data?.error ||
        err.reason ||
        err.message ||
        "Failed to confirm delivery.";
      setTx(key, { loading: false, error: msg });
    }
  };

  // ── Render ──────────────────────────────────────────────────────

  if (loading) return <p className="text-gray-500 text-sm">Loading escrows…</p>;

  // Filter accepted quotes that already have escrows
  const escrowQuoteIds = escrows.map((e) => e.quote_id);
  const quotesNeedingEscrow = acceptedQuotes.filter(
    (q) => !escrowQuoteIds.includes(q.id)
  );

  return (
    <div>
      {/* ── Accepted Quotes Needing Escrow ─────────────────────── */}
      {quotesNeedingEscrow.length > 0 && (
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-green-700 mb-3">
            💼 Create Escrow for Accepted Quotes
          </h3>
          {quotesNeedingEscrow.map((quote) => {
            const key = `create-${quote.id}`;
            const tx = txStatus[key] || {};
            const acceptedBid = quote.bids?.find((b) => b.status === "accepted");
            const totalAmount = acceptedBid
              ? (parseFloat(acceptedBid.bid_amount) * parseFloat(quote.quantity)).toFixed(6)
              : null;
            return (
              <div
                key={quote.id}
                className="bg-white border border-green-200 rounded-xl p-4 mb-3 shadow-sm"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-semibold text-gray-800">
                      {quote.product_name} — {quote.quantity} {quote.unit}
                    </p>
                    {acceptedBid && (
                      <>
                        <p className="text-sm text-gray-600">
                          FPO: {acceptedBid.fpo_name} — {acceptedBid.bid_amount} ETH/unit
                        </p>
                        <p className="text-sm font-semibold text-green-700">
                          Total Escrow: {totalAmount} ETH
                        </p>
                      </>
                    )}
                  </div>
                  <button
                    onClick={() => createEscrow(quote)}
                    disabled={tx.loading}
                    className={`px-4 py-2 rounded-lg text-sm font-semibold text-white ${
                      tx.loading
                        ? "bg-gray-400 cursor-not-allowed"
                        : "bg-green-600 hover:bg-green-700"
                    }`}
                  >
                    {tx.loading ? "⏳ Processing..." : "🔐 Create Escrow"}
                  </button>
                </div>
                {tx.success && (
                  <p className="text-sm text-green-600 mt-2">✅ {tx.success}</p>
                )}
                {tx.error && (
                  <p className="text-sm text-red-600 mt-2">❌ {tx.error}</p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Active Escrows ─────────────────────────────────────── */}
      {escrows.length === 0 && quotesNeedingEscrow.length === 0 ? (
        <div className="bg-green-50 border border-green-200 rounded-2xl p-8 text-center">
          <p className="text-green-700 font-medium">No escrow transactions yet.</p>
          <p className="text-gray-500 text-sm mt-1">
            Accept an FPO bid, then create an escrow for secure payment.
          </p>
        </div>
      ) : (
        escrows.map((escrow) => {
          const key = `delivery-${escrow.id}`;
          const tx = txStatus[key] || {};
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
                  <span className="font-medium text-gray-500">FPO:</span>{" "}
                  {escrow.fpo_name}
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

              {/* Confirm Delivery button */}
              {escrow.status === "funded" && (
                <div className="mt-3">
                  <button
                    onClick={() => confirmDelivery(escrow)}
                    disabled={tx.loading}
                    className={`px-4 py-2 rounded-lg text-sm font-semibold text-white ${
                      tx.loading
                        ? "bg-gray-400 cursor-not-allowed"
                        : "bg-purple-600 hover:bg-purple-700"
                    }`}
                  >
                    {tx.loading ? "⏳ Processing..." : "📦 Confirm Delivery"}
                  </button>
                  {tx.success && (
                    <p className="text-sm text-green-600 mt-2">{tx.success}</p>
                  )}
                  {tx.error && (
                    <p className="text-sm text-red-600 mt-2">❌ {tx.error}</p>
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
                    Delivery:{" "}
                    {new Date(escrow.delivery_confirmed_at).toLocaleString()}
                  </p>
                )}
                {escrow.released_at && (
                  <p>Released: {new Date(escrow.released_at).toLocaleString()}</p>
                )}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
