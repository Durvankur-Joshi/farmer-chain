/**
 * MintButton.jsx — Phase 2.2
 *
 * Complete MetaMask minting flow:
 *  1. Request backend to prepare metadata + upload to IPFS (server-side Pinata)
 *  2. Verify MetaMask is present
 *  3. Switch to Sepolia if needed
 *  4. Compare connected wallet with registered farmer wallet (case-insensitive)
 *  5. Call contract.mintCropPassport(tokenURI) via ethers.js
 *  6. Wait for tx confirmation
 *  7. Extract tokenId from CropPassportMinted event
 *  8. Call confirm-mint endpoint
 *  9. Callback to refresh crop list
 *
 * Private keys are NEVER requested or stored.
 * Pinata credentials NEVER touch the browser.
 */
import React, { useState } from "react";
import axios from "axios";
import { ethers } from "ethers";
import CropPassportABI from "../../utils/CropPassportABI.json";

const CONTRACT_ADDRESS = import.meta.env.VITE_CROP_PASSPORT_CONTRACT;
const SEPOLIA_CHAIN_ID = "0xaa36a7"; // 11155111 in hex

export default function MintButton({ crop, onMintSuccess }) {
  const [status, setStatus] = useState("");
  const [error, setError]   = useState("");
  const [minting, setMinting] = useState(false);

  if (crop.status === "minted") {
    return (
      <span className="text-xs bg-green-100 text-green-700 px-3 py-1 rounded-full font-semibold">
        ✅ NFT Minted
      </span>
    );
  }

  const handleMint = async () => {
    setError("");
    setStatus("");
    setMinting(true);

    try {
      // ── 1. Check MetaMask ──────────────────────────────────────────
      if (!window.ethereum) {
        throw new Error("MetaMask is not installed. Please install MetaMask to mint NFTs.");
      }

      // ── 2. Request accounts ────────────────────────────────────────
      setStatus("Connecting to MetaMask…");
      let accounts;
      try {
        accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
      } catch (connErr) {
        if (connErr.code === 4001) {
          throw new Error(
            "MetaMask connection rejected. Please click 'Connect' when MetaMask asks for permission."
          );
        }
        throw new Error(
          `Could not connect to MetaMask: ${connErr.message}. ` +
          "Make sure MetaMask is unlocked and this site is connected " +
          "(click the MetaMask icon → Connected sites → connect localhost:5173)."
        );
      }
      const connectedWallet = accounts[0];

      // ── 3. Switch to / add Sepolia ─────────────────────────────────
      const chainId = await window.ethereum.request({ method: "eth_chainId" });
      if (chainId !== SEPOLIA_CHAIN_ID) {
        setStatus("Switching to Sepolia…");
        try {
          await window.ethereum.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: SEPOLIA_CHAIN_ID }],
          });
        } catch (switchErr) {
          // 4902 = chain not added to MetaMask yet — add it automatically
          if (switchErr.code === 4902) {
            try {
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
            } catch (addErr) {
              throw new Error(
                "Could not add Sepolia network to MetaMask. " +
                "Please add it manually: Network name=Sepolia, Chain ID=11155111, " +
                "RPC=https://rpc.sepolia.org"
              );
            }
          } else if (switchErr.code === 4001) {
            throw new Error("You rejected the network switch. Please switch to Sepolia in MetaMask and try again.");
          } else {
            throw new Error("Please switch MetaMask to the Ethereum Sepolia network and try again.");
          }
        }
      }


      // ── 4. Verify wallet matches registered farmer wallet ──────────
      setStatus("Verifying wallet…");
      const mintPrepRes = await axios.post(
        `/api/farmer/crops/${crop.id}/mint/`,
        {},
        { withCredentials: true }
      );
      const { token_uri, farmer_wallet } = mintPrepRes.data;

      if (connectedWallet.toLowerCase() !== farmer_wallet.toLowerCase()) {
        throw new Error(
          `Connected MetaMask wallet (${connectedWallet.slice(0, 8)}…) ` +
          `does not match your registered FarmerChain wallet ` +
          `(${farmer_wallet.slice(0, 8)}…). ` +
          "Please switch to your registered wallet in MetaMask."
        );
      }

      // ── 5. Check contract address is configured ────────────────────
      if (!CONTRACT_ADDRESS || CONTRACT_ADDRESS === "0xYourCropPassportContractAddress") {
        throw new Error(
          "NFT contract address is not configured. " +
          "Deploy FarmerChainCropPassport.sol via Remix and set " +
          "VITE_CROP_PASSPORT_CONTRACT in frontend/.env."
        );
      }

      // ── 6. Call contract via ethers.js ─────────────────────────────
      setStatus("Waiting for MetaMask confirmation…");
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer   = provider.getSigner();
      const contract = new ethers.Contract(CONTRACT_ADDRESS, CropPassportABI, signer);

      let tx;
      try {
        tx = await contract.mintCropPassport(token_uri);
      } catch (txErr) {
        if (txErr.code === 4001 || txErr.code === "ACTION_REJECTED") {
          throw new Error("Transaction rejected in MetaMask.");
        }
        throw new Error(`Transaction failed: ${txErr.message}`);
      }

      // ── 7. Wait for mining ─────────────────────────────────────────
      setStatus("Transaction submitted. Waiting for blockchain confirmation… ⛓️");
      let receipt;
      try {
        receipt = await tx.wait(1); // wait for 1 confirmation
      } catch (waitErr) {
        throw new Error(`Transaction failed on-chain: ${waitErr.message}`);
      }

      // ── 8. Extract token ID from CropPassportMinted event ──────────
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
          // not a matching log — skip
        }
      }
      if (!tokenId) {
        // Fallback: try to get from return value (may not be available for eth_call)
        tokenId = receipt.logs.length > 0 ? "unknown" : null;
      }

      // ── 9. Confirm mint on backend ─────────────────────────────────
      setStatus("Recording NFT on FarmerChain…");
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

      setStatus("🎉 NFT Crop Passport minted successfully!");
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
    <div className="mt-2">
      <button
        onClick={handleMint}
        disabled={minting}
        className="bg-purple-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-purple-700 disabled:opacity-50 font-semibold"
      >
        {minting ? "⏳ Minting…" : "🪙 Mint NFT Crop Passport"}
      </button>

      {status && (
        <p className="mt-2 text-xs text-blue-600 font-medium">{status}</p>
      )}
      {error && (
        <p className="mt-2 text-xs text-red-600 font-medium">❌ {error}</p>
      )}
    </div>
  );
}
