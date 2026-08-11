import React, { useState } from "react";
import axios from "axios";
import Cookies from "js-cookie";
import { ethers } from "ethers";
import CropPassportABI from "../../utils/CropPassportABI.json";
import StatusBadge from "../common/StatusBadge";

const CONTRACT_ADDRESS = import.meta.env.VITE_CROP_PASSPORT_CONTRACT;
const SEPOLIA_CHAIN_ID = "0xaa36a7"; // 11155111 in hex

export default function MintButton({ crop, onMintSuccess }) {
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [minting, setMinting] = useState(false);

  if (crop.status === "minted") {
    return <StatusBadge status="minted" />;
  }

  const handleMint = async () => {
    setError("");
    setStatus("");
    setMinting(true);

    try {
      if (!window.ethereum) {
        throw new Error("MetaMask is not installed. Please install MetaMask to mint NFTs.");
      }

      setStatus("Connecting to MetaMask wallet…");
      let accounts;
      try {
        accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
      } catch (connErr) {
        if (connErr.code === 4001) {
          throw new Error("MetaMask connection was rejected.");
        }
        throw new Error(`Could not connect to MetaMask: ${connErr.message}`);
      }
      const connectedWallet = accounts[0];

      const chainId = await window.ethereum.request({ method: "eth_chainId" });
      if (chainId !== SEPOLIA_CHAIN_ID) {
        setStatus("Switching network to Ethereum Sepolia Testnet…");
        try {
          await window.ethereum.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: SEPOLIA_CHAIN_ID }],
          });
        } catch (switchErr) {
          if (switchErr.code === 4902) {
            await window.ethereum.request({
              method: "wallet_addEthereumChain",
              params: [
                {
                  chainId: SEPOLIA_CHAIN_ID,
                  chainName: "Sepolia Test Network",
                  nativeCurrency: { name: "SepoliaETH", symbol: "ETH", decimals: 18 },
                  rpcUrls: ["https://rpc.sepolia.org"],
                  blockExplorerUrls: ["https://sepolia.etherscan.io"],
                },
              ],
            });
          } else {
            throw new Error("Please switch your MetaMask network to Sepolia.");
          }
        }
      }

      const token =
        localStorage.getItem("access_token") ||
        Cookies.get("access_token") ||
        Cookies.get("token");

      const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};

      setStatus("Preparing IPFS metadata & decentralized token URI…");
      const mintPrepRes = await axios.post(
        `/api/farmer/crops/${crop.id}/mint/`,
        {},
        {
          withCredentials: true,
          headers: authHeaders,
        }
      );
      const { token_uri, farmer_wallet } = mintPrepRes.data;

      if (connectedWallet.toLowerCase() !== farmer_wallet.toLowerCase()) {
        throw new Error(
          `Connected MetaMask wallet (${connectedWallet.slice(0, 8)}…) ` +
          `does not match your registered Farmer wallet (${farmer_wallet.slice(0, 8)}…).`
        );
      }

      if (!CONTRACT_ADDRESS || CONTRACT_ADDRESS === "0xYourCropPassportContractAddress") {
        throw new Error("Crop Passport NFT contract address is not configured.");
      }

      setStatus("Confirm transaction in MetaMask…");
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      const contract = new ethers.Contract(CONTRACT_ADDRESS, CropPassportABI, signer);

      let tx;
      try {
        tx = await contract.mintCropPassport(token_uri);
      } catch (txErr) {
        if (txErr.code === 4001 || txErr.code === "ACTION_REJECTED") {
          throw new Error("Transaction was rejected in MetaMask.");
        }
        throw new Error(`Transaction error: ${txErr.message}`);
      }

      setStatus("Transaction submitted! Waiting for Sepolia block confirmation… ⛓️");
      let receipt = await tx.wait(1);

      let tokenId = null;
      const iface = new ethers.utils.Interface(CropPassportABI);
      for (const log of receipt.logs) {
        try {
          const parsed = iface.parseLog(log);
          if (parsed.name === "CropPassportMinted") {
            tokenId = parsed.args.tokenId.toString();
            break;
          }
        } catch {
          // non-matching log
        }
      }
      if (!tokenId) {
        tokenId = receipt.logs.length > 0 ? "unknown" : null;
      }

      setStatus("Recording NFT certificate on FarmerChain protocol…");
      await axios.post(
        `/api/farmer/crops/${crop.id}/confirm-mint/`,
        {
          token_id: tokenId,
          contract_address: CONTRACT_ADDRESS,
          tx_hash: receipt.transactionHash,
          token_uri: token_uri,
        },
        {
          withCredentials: true,
          headers: authHeaders,
        }
      );

      setStatus("🎉 NFT Crop Passport successfully minted on Ethereum Sepolia!");
      onMintSuccess && onMintSuccess();
    } catch (err) {
      console.error("Mint error:", err);
      setError(err.message || "Minting failed. Please try again.");
      setStatus("");
    } finally {
      setMinting(false);
    }
  };

  const hasCropData = !!(crop.crop_name && crop.crop_category && crop.quantity > 0 && crop.unit && crop.cultivation_date && crop.harvest_date);
  const latestAI = crop.latest_ai_verification || (crop.ai_verifications && crop.ai_verifications[0]);
  const hasPrimaryImage = !!(crop.primary_image_url || latestAI?.image_gateway_url);
  const hasAIVerified = !!(latestAI && latestAI.verification_status === "verified");

  const isReadyToMint = hasCropData && hasPrimaryImage && hasAIVerified;

  return (
    <div className="space-y-2.5">
      {!isReadyToMint && (
        <div className="p-3 bg-purple-50/70 border border-purple-200 rounded-xl text-xs space-y-1.5 mb-2">
          <p className="font-extrabold text-purple-950 flex items-center gap-1.5">
            <span>🔒</span>
            <span>Minting Requirements Checklist</span>
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-[11px] font-semibold">
            <span className={hasCropData ? "text-emerald-700 font-bold" : "text-rose-600"}>
              {hasCropData ? "✓" : "❌"} Crop Details Complete
            </span>
            <span className={hasPrimaryImage ? "text-emerald-700 font-bold" : "text-rose-600"}>
              {hasPrimaryImage ? "✓" : "❌"} Primary Crop Image
            </span>
            <span className={hasAIVerified ? "text-emerald-700 font-bold" : "text-rose-600"}>
              {hasAIVerified ? `✓ AI Verified (${latestAI?.quality_grade ? `Grade ${latestAI.quality_grade}` : 'Verified'})` : "❌ AI Verification Required"}
            </span>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={handleMint}
        disabled={minting || !isReadyToMint}
        className={`text-xs font-bold px-4 py-2 rounded-xl transition-all shadow-xs flex items-center gap-2 ${
          isReadyToMint
            ? "bg-purple-600 hover:bg-purple-500 text-white cursor-pointer shadow-purple-900/20"
            : "bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed"
        }`}
      >
        <span>{isReadyToMint ? "🪙" : "🔒"}</span>
        <span>{minting ? "Minting on Sepolia…" : isReadyToMint ? "Mint NFT Digital Twin" : "Minting Gated (Complete Checklist)"}</span>
      </button>

      {status && (
        <div className="text-xs text-purple-900 font-semibold bg-purple-50 border border-purple-200 p-3 rounded-xl flex items-center gap-2 animate-fade-in">
          <span className="animate-spin text-purple-600">⏳</span>
          <span>{status}</span>
        </div>
      )}
      {error && (
        <div className="text-xs text-rose-800 font-medium bg-rose-50 border border-rose-200 p-3 rounded-xl flex items-center gap-2">
          <span>❌</span>
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
