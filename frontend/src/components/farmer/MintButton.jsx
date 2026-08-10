/**
 * MintButton.jsx — Phase 2.2 + UI Modernization
 * Modernized MetaMask minting component with clear feedback states.
 */
import React, { useState } from "react";
import axios from "axios";
import { ethers } from "ethers";
import CropPassportABI from "../../utils/CropPassportABI.json";
import StatusBadge from "../common/StatusBadge";

const CONTRACT_ADDRESS = import.meta.env.VITE_CROP_PASSPORT_CONTRACT;
const SEPOLIA_CHAIN_ID = "0xaa36a7"; // 11155111 in hex

export default function MintButton({ crop, onMintSuccess }) {
  const [status, setStatus] = useState("");
  const [error, setError]   = useState("");
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

      setStatus("Connecting to MetaMask…");
      let accounts;
      try {
        accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
      } catch (connErr) {
        if (connErr.code === 4001) {
          throw new Error("MetaMask connection rejected.");
        }
        throw new Error(`Could not connect to MetaMask: ${connErr.message}`);
      }
      const connectedWallet = accounts[0];

      const chainId = await window.ethereum.request({ method: "eth_chainId" });
      if (chainId !== SEPOLIA_CHAIN_ID) {
        setStatus("Switching to Sepolia Testnet…");
        try {
          await window.ethereum.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: SEPOLIA_CHAIN_ID }],
          });
        } catch (switchErr) {
          if (switchErr.code === 4902) {
            await window.ethereum.request({
              method: "wallet_addEthereumChain",
              params: [{
                chainId: SEPOLIA_CHAIN_ID,
                chainName: "Sepolia",
                nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
                rpcUrls: ["https://rpc.sepolia.org"],
                blockExplorerUrls: ["https://sepolia.etherscan.io"],
              }],
            });
          } else {
            throw new Error("Please switch MetaMask to Sepolia network.");
          }
        }
      }

      setStatus("Preparing IPFS metadata & token URI…");
      const mintPrepRes = await axios.post(
        `/api/farmer/crops/${crop.id}/mint/`,
        {},
        { withCredentials: true }
      );
      const { token_uri, farmer_wallet } = mintPrepRes.data;

      if (connectedWallet.toLowerCase() !== farmer_wallet.toLowerCase()) {
        throw new Error(
          `Connected MetaMask wallet (${connectedWallet.slice(0, 8)}…) ` +
          `does not match your registered Farmer wallet (${farmer_wallet.slice(0, 8)}…).`
        );
      }

      if (!CONTRACT_ADDRESS || CONTRACT_ADDRESS === "0xYourCropPassportContractAddress") {
        throw new Error("NFT contract address is not configured.");
      }

      setStatus("Confirm transaction in MetaMask…");
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer   = provider.getSigner();
      const contract = new ethers.Contract(CONTRACT_ADDRESS, CropPassportABI, signer);

      let tx;
      try {
        tx = await contract.mintCropPassport(token_uri);
      } catch (txErr) {
        if (txErr.code === 4001 || txErr.code === "ACTION_REJECTED") {
          throw new Error("Transaction cancelled in MetaMask.");
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
          // not a matching log
        }
      }
      if (!tokenId) {
        tokenId = receipt.logs.length > 0 ? "unknown" : null;
      }

      setStatus("Recording NFT certificate on FarmerChain…");
      await axios.post(
        `/api/farmer/crops/${crop.id}/confirm-mint/`,
        {
          token_id:         tokenId,
          contract_address: CONTRACT_ADDRESS,
          tx_hash:          receipt.transactionHash,
          token_uri:        token_uri,
        },
        { withCredentials: true }
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

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={handleMint}
        disabled={minting}
        className="bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold px-4 py-2 rounded-xl transition-all shadow-xs disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
      >
        <span>🪙</span>
        <span>{minting ? "Minting on Sepolia…" : "Mint NFT Digital Twin"}</span>
      </button>

      {status && (
        <p className="text-xs text-blue-700 font-semibold bg-blue-50 border border-blue-200 p-2.5 rounded-xl">
          ℹ️ {status}
        </p>
      )}
      {error && (
        <p className="text-xs text-rose-700 font-semibold bg-rose-50 border border-rose-200 p-2.5 rounded-xl">
          ⚠️ {error}
        </p>
      )}
    </div>
  );
}
