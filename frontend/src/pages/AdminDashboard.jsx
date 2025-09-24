  import React, { useState, useEffect } from "react";
  import { useNavigate } from "react-router-dom";
  import { ethers } from "ethers";
  import axios from "axios";

  export default function AdminDashboard() {
    const navigate = useNavigate();
    const [wallet, setWallet] = useState("");
    const [status, setStatus] = useState("");
    const [loadingTx, setLoadingTx] = useState(false);
    const [pending, setPending] = useState({
      farmers: [],
      fpos: [],
      retailers: [],
    });

    // Contract + Admin
    const contractAddress = "0x7022b2D5462cBE3785FF5359E19f18eD396D8397";
    const ADMIN_ADDRESS = "0xAd91CE97681d52fE448a71E6556DdECc16f12B2E";





    // ABI from whitelist.html
    const factoryABI = [
      /* paste ABI here */

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

          // Events
          {
            anonymous: false,
            inputs: [
              {
                indexed: true,
                internalType: "address",
                name: "contractAddress",
                type: "address",
              },
              {
                indexed: true,
                internalType: "address",
                name: "farmer",
                type: "address",
              },
            ],
            name: "NewFarmerContract",
            type: "event",
          },

          // Whitelisting
          {
            inputs: [
              { internalType: "address", name: "_farmer", type: "address" },
            ],
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
            inputs: [
              { internalType: "address", name: "_retailer", type: "address" },
            ],
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
            inputs: [
              { internalType: "address", name: "_farmer", type: "address" },
            ],
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
            inputs: [
              { internalType: "address", name: "_retailer", type: "address" },
            ],
            name: "isRetailerWhitelisted",
            outputs: [{ internalType: "bool", name: "", type: "bool" }],
            stateMutability: "view",
            type: "function",
          },

          // Deployed contracts
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

          // Child contract details
          {
            inputs: [
              { internalType: "address", name: "_contract", type: "address" },
            ],
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
            inputs: [
              { internalType: "address", name: "_contract", type: "address" },
            ],
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
            inputs: [
              { internalType: "address", name: "_contract", type: "address" },
            ],
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
            inputs: [
              { internalType: "address", name: "_contract", type: "address" },
            ],
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

          // Restored helper functions
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
            inputs: [
              { internalType: "address", name: "_contract", type: "address" },
            ],
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


    // Always use Sepolia RPC for reads
  // const sepoliaProvider = new ethers.providers.JsonRpcProvider("https://rpc.sepolia.org");

  // Get contract with read-only provider
  const contractRead = new ethers.Contract(contractAddress, factoryABI);



  // For writes we still use signer from MetaMask (but force Sepolia first)
  const getWriteContract = async () => {
    await switchToSepolia();
    const web3Provider = new ethers.providers.Web3Provider(window.ethereum);
    const signer = web3Provider.getSigner();
    return new ethers.Contract(contractAddress, factoryABI, signer);
  };



    const getContract = (signerOrProvider) =>
      new ethers.Contract(contractAddress, factoryABI, signerOrProvider);


    // Helper: force MetaMask to Sepolia
  const switchToSepolia = async () => {
    if (!window.ethereum) {
      setStatus("MetaMask not found!");
      return;
    }
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: "0xaa36a7" }], // Sepolia chainId
      });
      setStatus("✅ Connected to Sepolia");
    } catch (switchError) {
      if (switchError.code === 4902) {
        try {
          await window.ethereum.request({
            method: "wallet_addEthereumChain",
            params: [
              {
                chainId: "0xaa36a7", // Sepolia
                chainName: "Sepolia Test Network",
                nativeCurrency: {
                  name: "SepoliaETH",
                  symbol: "ETH",
                  decimals: 18,
                },
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




  // Connect MetaMask (always Sepolia)
  const connectWallet = async () => {
    if (!window.ethereum) return setStatus("Install MetaMask!");
    try {
      await switchToSepolia(); // ⬅️ force Sepolia first

      const accounts = await window.ethereum.request({
        method: "eth_requestAccounts",
      });
      const account = accounts[0];
      setWallet(account);

      if (account.toLowerCase() === ADMIN_ADDRESS.toLowerCase()) {
        setStatus("✅ Connected as Admin (Sepolia)");
      } else {
        setStatus("❌ Not admin address");
      }
    } catch (e) {
      setStatus("❌ Wallet connection failed");
    }
  };


    // Fetch pending registrations from backend
    const fetchPending = async () => {
      try {
        const token = localStorage.getItem("access"); // stored after login
        const res = await axios.get("/api/admin/pending-registrations/", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        console.log(res.data);
        
        setPending(res.data); // expecting {farmers:[], fpos:[], retailers:[]}
      } catch (err) {
        setStatus("Error fetching pending registrations");
      }
    };

    useEffect(() => {
      fetchPending();
    }, []);

    // Handle transaction lifecycle
    const handleTx = async (tx, successMsg) => {
      try {
        setLoadingTx(true);
        setStatus(`⏳ Transaction sent: ${tx.hash}`);
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        const receipt = await provider.waitForTransaction(tx.hash);
        if (receipt.status === 1) {
          setStatus(`✅ ${successMsg} (Block: ${receipt.blockNumber})`);
          fetchPending(); // refresh list
        } else {
          setStatus("❌ Transaction failed");
        }
      } catch (err) {
        setStatus("Error: " + err.message);
      } finally {
        setLoadingTx(false);
      }
    };

    // Approve + Whitelist
    const approve = async (role, id, addr) => {
    try {
      const token = localStorage.getItem("access");

      // Step 1: blockchain whitelisting
      const contract = await getWriteContract();
      let tx;
      if (role === "Farmer") tx = await contract.whitelistFarmer(addr);
      if (role === "FPO") tx = await contract.whitelistFPO(addr);
      if (role === "Retailer") tx = await contract.whitelistRetailer(addr);

      await handleTx(tx, `${role} approved & whitelisted`);

      // Step 2: backend approve
      await axios.post(
        `/api/admin/approve-${role.toLowerCase()}/${id}/`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
    } catch (err) {
      setStatus("Error approving " + role + ": " + err.message);
    }
  };


  const reject = async (role, id) => {
    try {
      const token = localStorage.getItem("access");
      await axios.post(
        `/api/admin/reject-${role.toLowerCase()}/${id}/`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setStatus(`❌ Rejected ${role}`);
      fetchPending();
    } catch (err) {
      setStatus("Error rejecting " + role + ": " + err.message);
    }
  };


    // Logout
    const logout = () => {
      localStorage.clear();
      navigate("/");
    };

    return (
      <div className="p-6 max-w-5xl mx-auto bg-white shadow-lg rounded-xl min-h-screen">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">🌾 Admin Dashboard</h2>
          <button
            onClick={logout}
            className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
          >
            Logout
          </button>
        </div>

        {/* Wallet + Contract Info */}
        <div className="bg-blue-100 p-3 rounded mb-4 text-center">
          <p>
            <strong>Admin Address:</strong> {ADMIN_ADDRESS}
          </p>
          <p>
            <strong>Contract:</strong> {contractAddress}
          </p>
          <p>
            <strong>Connected Wallet:</strong> {wallet || "Not connected yet"}
          </p>
        </div>
        <button
          onClick={connectWallet}
          className="bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded mb-6"
        >
          Connect MetaMask
        </button>

        {/* Pending Farmers */}
        <div className="mb-6">
          <h3 className="text-xl font-semibold mb-2">👨‍🌾 Pending Farmers</h3>
          {pending.farmers.length === 0 ? (
            <p className="text-gray-500">No pending farmers</p>
          ) : (
            pending.farmers.map((f) => (
              <div
                key={f.id}
                className="flex justify-between items-center border p-3 rounded mb-2"
              >
                <div>
                  <p>
                    <strong>{f.name}</strong> ({f.email})
                  </p>
                  <p className="text-sm text-gray-500">{f.wallet_address}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    disabled={loadingTx}
                    onClick={() => approve("Farmer", f.id, f.wallet_address)}
                    className="bg-green-600 text-white px-3 py-1 rounded"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => reject("Farmer", f.id)}
                    className="bg-red-600 text-white px-3 py-1 rounded"
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Pending FPOs */}
        <div className="mb-6">
          <h3 className="text-xl font-semibold mb-2">🏢 Pending FPOs</h3>
          {pending.fpos.length === 0 ? (
            <p className="text-gray-500">No pending FPOs</p>
          ) : (
            pending.fpos.map((f) => (
              <div
                key={f.id}
                className="flex justify-between items-center border p-3 rounded mb-2"
              >
                <div>
                  <p>
                    <strong>{f.name}</strong> ({f.email})
                  </p>
                  <p className="text-sm text-gray-500">{f.wallet_address}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    disabled={loadingTx}
                    onClick={() => approve("FPO", f.id, f.wallet_address)}
                    className="bg-green-600 text-white px-3 py-1 rounded"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => reject("FPO", f.id)}
                    className="bg-red-600 text-white px-3 py-1 rounded"
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Pending Retailers */}
        <div className="mb-6">
          <h3 className="text-xl font-semibold mb-2">🛒 Pending Retailers</h3>
          {pending.retailers.length === 0 ? (
            <p className="text-gray-500">No pending retailers</p>
          ) : (
            pending.retailers.map((r) => (
              <div
                key={r.id}
                className="flex justify-between items-center border p-3 rounded mb-2"
              >
                <div>
                  <p>
                    <strong>{r.name}</strong> ({r.email})
                  </p>
                  <p className="text-sm text-gray-500">{r.wallet_address}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    disabled={loadingTx}
                    onClick={() => approve("Retailer", r.id, r.wallet_address)}
                    className="bg-green-600 text-white px-3 py-1 rounded"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => reject("Retailer", r.id)}
                    className="bg-red-600 text-white px-3 py-1 rounded"
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Status */}
        {status && (
          <div className="p-3 mt-4 rounded text-center bg-gray-100">{status}</div>
        )}
      </div>
    );
  }
