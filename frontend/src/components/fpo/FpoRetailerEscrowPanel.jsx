import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { ethers } from "ethers";
import { useRefresh, useRefreshSubscription } from "../../context/useRefresh";
import EscrowABI from "../../utils/EscrowABI.json";
import EscrowDealCard from "../common/EscrowDealCard";
import EscrowDealModal from "../common/EscrowDealModal";

const ESCROW_CONTRACT = __ENV_ESCROW_CONTRACT_ADDRESS__;
const SEPOLIA_CHAIN_ID = "0xaa36a7"; // 11155111

export default function FpoRetailerEscrowPanel({ onEscrowUpdated }) {
  const { refresh } = useRefresh();
  const [escrows, setEscrows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [txStatus, setTxStatus] = useState({});
  const [awardedQuotes, setAwardedQuotes] = useState([]);
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

  const fetchAwardedQuotes = useCallback(async () => {
    try {
      const res = await axios.get("/api/fpo/quotes/", { withCredentials: true });
      const quotes = res.data || [];
      const awarded = quotes.filter(
        (q) => (q.status === "awarded" || !!q.accepted_bid) && !q.escrow
      );
      setAwardedQuotes(awarded);
    } catch (err) {
      console.error("Error fetching awarded FPO quotes:", err);
    }
  }, []);

  useEffect(() => {
    fetchEscrows();
    fetchAwardedQuotes();
  }, [fetchEscrows, fetchAwardedQuotes]);

  useRefreshSubscription(["escrow", "deals", "quotes", "fpo", "retailer"], () => {
    fetchEscrows();
    fetchAwardedQuotes();
  });

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

  const extractEscrowId = (receipt, fallbackQuoteId) => {
    try {
      const iface = new ethers.utils.Interface(EscrowABI);
      for (const log of receipt.logs) {
        try {
          const parsed = iface.parseLog(log);
          if (parsed && parsed.name === "EscrowCreated") {
            const rawId = parsed.args.escrowId;
            return rawId ? Number(rawId.toString()) : null;
          }
        } catch {
          // ignore
        }
      }
    } catch (e) {
      console.warn("Could not parse EscrowCreated log:", e);
    }
    return fallbackQuoteId ? Number(fallbackQuoteId) : null;
  };

  const setTx = (id, update) =>
    setTxStatus((prev) => ({ ...prev, [id]: { ...(prev[id] || {}), ...update } }));

  // ── Create Escrow for Retailer Deal ─────────────────────────────
  const createRetailerEscrow = async (quote) => {
    const key = `create-${quote.id}`;
    try {
      setTx(key, { loading: true, error: null, success: null });

      const res = await axios.post(
        `/api/escrow/retailer/${quote.id}/create/`,
        {},
        { withCredentials: true }
      );
      const escrowData = res.data;

      const contract = await getContract();
      const amountWei = ethers.utils.parseEther(String(escrowData.amount_eth));
      const retailerWallet = escrowData.retailer_wallet;
      if (!retailerWallet) throw new Error("Retailer buyer wallet address is missing.");

      setTx(key, { loading: true, success: "Please confirm createEscrow in MetaMask…" });
      const tx = await contract.createEscrow(retailerWallet, amountWei, quote.id);

      setTx(key, { loading: true, success: "Waiting for Sepolia blockchain confirmation…" });
      const receipt = await tx.wait();

      const onChainId = extractEscrowId(receipt, quote.id);
      if (onChainId === null) {
        throw new Error("Transaction confirmed, but EscrowCreated event could not be decoded.");
      }

      await axios.post(
        `/api/escrow/retailer/${escrowData.id}/created-onchain/`,
        { tx_hash: receipt.transactionHash, escrow_id: onChainId, contract_address: ESCROW_CONTRACT },
        { withCredentials: true }
      );

      setTx(key, { loading: false, success: `Wholesale Escrow #${onChainId} created on Sepolia! ✅` });
      await Promise.all([fetchEscrows(), fetchAwardedQuotes()]);
      if (onEscrowUpdated) onEscrowUpdated();
      refresh(["escrow", "deals", "quotes", "fpo", "retailer"]);
    } catch (err) {
      console.error("Create retailer escrow error:", err);
      let msg = err.response?.data?.error || err.reason || err.message || "Failed to create wholesale escrow.";
      if (err.code === 4001 || err.code === "ACTION_REJECTED") {
        msg = "Transaction was rejected in MetaMask.";
      }
      setTx(key, { loading: false, error: msg });
    }
  };

  // ── Confirm Delivery to Retailer ────────────────────────────────
  const confirmDelivery = async (escrow) => {
    const key = `delivery-${escrow.id}`;
    try {
      setTx(key, { loading: true, error: null, success: null });

      if (!escrow.escrow_id) throw new Error("On-chain escrow ID missing.");

      const contract = await getContract();
      setTx(key, { loading: true, success: "Confirming dispatch handover via MetaMask…" });

      const tx = await contract.confirmDelivery(escrow.escrow_id);
      setTx(key, { loading: true, success: "Waiting for Sepolia blockchain confirmation…" });
      const receipt = await tx.wait();

      await axios.post(
        `/api/escrow/retailer/${escrow.id}/delivery-confirm/`,
        { tx_hash: receipt.transactionHash },
        { withCredentials: true }
      );

      setTx(key, { loading: false, success: "Delivery handover confirmed on Sepolia! ✅" });
      await fetchEscrows();
      if (onEscrowUpdated) onEscrowUpdated();
      refresh(["escrow", "deals", "quotes", "fpo", "retailer"]);
    } catch (err) {
      console.error("Confirm retailer delivery error:", err);
      let msg = err.response?.data?.error || err.reason || err.message || "Failed to confirm delivery.";
      if (err.code === 4001 || err.code === "ACTION_REJECTED") {
        msg = "Transaction was rejected in MetaMask.";
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

  const existingQuoteIds = escrows.map((e) => e.quote_id);
  const quotesNeedingEscrow = awardedQuotes.filter((q) => !existingQuoteIds.includes(q.id));

  // Derive action button for active modal escrow
  const renderModalAction = (escrow) => {
    if (!escrow) return null;
    const deliveryKey = `delivery-${escrow.id}`;
    const deliveryTx = txStatus[deliveryKey] || {};

    if (escrow.status === "funded") {
      return (
        <button
          type="button"
          onClick={() => confirmDelivery(escrow)}
          disabled={deliveryTx.loading}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50 text-xs"
        >
          <span>📦</span>
          <span>{deliveryTx.loading ? "Confirming…" : "Confirm Lot Handover to Retailer (MetaMask)"}</span>
        </button>
      );
    }

    return null;
  };

  const getModalActionStatus = (escrow) => {
    if (!escrow) return null;
    return txStatus[`delivery-${escrow.id}`] || null;
  };

  return (
    <div className="space-y-5">
      {/* ── Awarded Deals Awaiting Escrow Creation ─────────────────── */}
      {quotesNeedingEscrow.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between pb-1">
            <h3 className="text-xs font-bold uppercase tracking-wider text-purple-900 flex items-center gap-1.5">
              <span>🤝</span> Awarded Wholesale Deals Awaiting Escrow Creation
            </h3>
            <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-800">
              {quotesNeedingEscrow.length} Ready
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {quotesNeedingEscrow.map((quote) => {
              const key = `create-${quote.id}`;
              const tx = txStatus[key] || {};
              const acceptedBid = quote.bids?.find((b) => b.status === "accepted");
              const totalAmount = acceptedBid
                ? (parseFloat(acceptedBid.bid_amount) * parseFloat(quote.quantity)).toFixed(4)
                : null;

              return (
                <div
                  key={quote.id}
                  className="bg-purple-50/40 border border-purple-200 rounded-2xl p-4 shadow-2xs hover:border-purple-300 transition-all space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="text-sm font-extrabold text-slate-900 truncate">
                        {quote.product_name}
                      </h4>
                      <p className="text-xs text-slate-600">
                        Retail Buyer: <strong>{acceptedBid?.retailer_name || `Retailer #${acceptedBid?.retailer || ""}`}</strong>
                      </p>
                    </div>
                    <span className="text-xs font-bold font-mono text-purple-700 bg-white px-2 py-0.5 rounded-md border border-purple-200">
                      {totalAmount} ETH
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-1 border-t border-purple-100 text-xs">
                    <span className="text-slate-500 font-medium">
                      {quote.quantity} {quote.unit}
                    </span>

                    <button
                      type="button"
                      onClick={() => createRetailerEscrow(quote)}
                      disabled={tx.loading}
                      className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-white bg-purple-600 hover:bg-purple-500 shadow-xs flex items-center gap-1 cursor-pointer disabled:opacity-50 shrink-0"
                    >
                      <span>🔐</span>
                      <span>{tx.loading ? "Initializing…" : "Initialize Wholesale Escrow"}</span>
                    </button>
                  </div>

                  {tx.success && (
                    <div className="p-2 rounded-lg bg-emerald-100 border border-emerald-200 text-xs font-semibold text-emerald-800">
                      {tx.success}
                    </div>
                  )}
                  {tx.error && (
                    <div className="p-2 rounded-lg bg-rose-100 border border-rose-200 text-xs font-semibold text-rose-800">
                      {tx.error}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Active Retail Escrow List ────────────────────────────────── */}
      {escrows.length === 0 && quotesNeedingEscrow.length === 0 ? (
        <div className="py-12 text-center bg-slate-50/50 rounded-2xl border border-slate-100 space-y-2">
          <span className="text-4xl block mb-2">🏢</span>
          <p className="text-sm font-bold text-slate-800">No Retail Wholesale Escrows Active</p>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            When you accept retailer bids on wholesale market quotes, smart contract escrow transactions will be tracked here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between pb-1">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Active Wholesale Escrows ({escrows.length})
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {escrows.map((escrow) => {
              let requiredAction = null;
              if (escrow.status === "created") {
                requiredAction = "Awaiting Retailer Deposit";
              } else if (escrow.status === "funded") {
                requiredAction = "Confirm Delivery Handover";
              }

              return (
                <EscrowDealCard
                  key={escrow.id}
                  escrow={escrow}
                  partnerLabel="Retail Buyer"
                  partnerName={escrow.retailer_name}
                  requiredActionLabel={requiredAction}
                  onViewDeal={(esc) => setActiveModalEscrow(esc)}
                  isRetailer={false}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* ── Escrow Deal Detail Modal ───────────────────────────────── */}
      {activeModalEscrow && (
        <EscrowDealModal
          isOpen={Boolean(activeModalEscrow)}
          onClose={() => setActiveModalEscrow(null)}
          escrow={activeModalEscrow}
          partnerLabel="Retail Buyer"
          partnerName={activeModalEscrow.retailer_name}
          actionButton={renderModalAction(activeModalEscrow)}
          actionStatus={getModalActionStatus(activeModalEscrow)}
        />
      )}
    </div>
  );
}
