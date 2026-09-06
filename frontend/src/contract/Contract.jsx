import React, { useEffect, useState } from "react";
import Web3 from "web3";
import { useParams } from "react-router-dom";
import { Package, MapPin, DollarSign, CheckCircle, XCircle, User, Building2, Store } from "lucide-react";

const farmerContractABI = [
  {
    inputs: [],
    name: "farmerDetails",
    outputs: [
      { name: "farmerName", type: "string" },
      { name: "location", type: "string" },
      { name: "cropType", type: "string" },
      { name: "quantity", type: "uint256" },
      { name: "totalPrice", type: "uint256" },
      { name: "farmerWallet", type: "address" },
      { name: "isSold", type: "bool" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "fpoDetails",
    outputs: [
      { name: "fpoName", type: "string" },
      { name: "fpoLocation", type: "string" },
      { name: "agmarkNumber", type: "string" },
      { name: "fssaiLicenseNumber", type: "string" },
      { name: "agreedPrice", type: "uint256" },
      { name: "fpoWallet", type: "address" },
      { name: "hasPaid", type: "bool" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "retailerDetails",
    outputs: [
      { name: "retailerName", type: "string" },
      { name: "retailerLocation", type: "string" },
      { name: "agreedPrice", type: "uint256" },
      { name: "retailerWallet", type: "address" },
      { name: "hasPaid", type: "bool" },
    ],
    stateMutability: "view",
    type: "function",
  },
];

export default function Contract() {
  const { address } = useParams();
  const CONTRACT_ADDRESS = address;
  const [web3, setWeb3] = useState(null);
  const [farmer, setFarmer] = useState(null);
  const [fpo, setFpo] = useState(null);
  const [retailer, setRetailer] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      if (window.ethereum) {
        try {
          const web3Instance = new Web3(window.ethereum);
          setWeb3(web3Instance);

          const c = new web3Instance.eth.Contract(farmerContractABI, CONTRACT_ADDRESS);

          const farmerData = await c.methods.farmerDetails().call();
          const fpoData = await c.methods.fpoDetails().call();
          const retailerData = await c.methods.retailerDetails().call();

          setFarmer(farmerData);
          setFpo(fpoData);
          setRetailer(retailerData);
        } catch (error) {
          console.error("Error loading contract data:", error);
        } finally {
          setLoading(false);
        }
      } else {
        alert("Please install MetaMask!");
        setLoading(false);
      }
    };
    init();
  }, [CONTRACT_ADDRESS]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-blue-50 to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-green-500 border-t-transparent"></div>
          <p className="mt-4 text-gray-600 font-medium">Loading contract data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-blue-50 to-purple-50 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">Supply Chain Dashboard</h1>
          <p className="text-gray-600">Blockchain-powered transparency for agricultural supply chain</p>
          <div className="mt-4 inline-block bg-white px-4 py-2 rounded-full shadow-sm">
            <code className="text-xs text-gray-500 font-mono">{CONTRACT_ADDRESS}</code>
          </div>
        </div>

        {/* Status Timeline */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
          <div className="flex items-center justify-between relative">
            <div className="absolute top-6 left-0 right-0 h-1 bg-gray-200 -z-10"></div>
            <div className="flex-1 text-center relative">
              <div className="w-12 h-12 rounded-full bg-green-500 text-white flex items-center justify-center mx-auto mb-2 shadow-lg">
                <User className="w-6 h-6" />
              </div>
              <p className="text-sm font-semibold text-gray-800">Farmer</p>
              <p className="text-xs text-green-600 mt-1">Active</p>
            </div>
            <div className="flex-1 text-center relative">
              <div className={`w-12 h-12 rounded-full ${fpo && fpo.fpoWallet !== "0x0000000000000000000000000000000000000000" ? 'bg-blue-500' : 'bg-gray-300'} text-white flex items-center justify-center mx-auto mb-2 shadow-lg`}>
                <Building2 className="w-6 h-6" />
              </div>
              <p className="text-sm font-semibold text-gray-800">FPO</p>
              <p className={`text-xs mt-1 ${fpo && fpo.fpoWallet !== "0x0000000000000000000000000000000000000000" ? 'text-blue-600' : 'text-gray-400'}`}>
                {fpo && fpo.fpoWallet !== "0x0000000000000000000000000000000000000000" ? 'Registered' : 'Pending'}
              </p>
            </div>
            <div className="flex-1 text-center relative">
              <div className={`w-12 h-12 rounded-full ${retailer && retailer.retailerWallet !== "0x0000000000000000000000000000000000000000" ? 'bg-purple-500' : 'bg-gray-300'} text-white flex items-center justify-center mx-auto mb-2 shadow-lg`}>
                <Store className="w-6 h-6" />
              </div>
              <p className="text-sm font-semibold text-gray-800">Retailer</p>
              <p className={`text-xs mt-1 ${retailer && retailer.retailerWallet !== "0x0000000000000000000000000000000000000000" ? 'text-purple-600' : 'text-gray-400'}`}>
                {retailer && retailer.retailerWallet !== "0x0000000000000000000000000000000000000000" ? 'Registered' : 'Pending'}
              </p>
            </div>
          </div>
        </div>

        {/* Cards Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Farmer Card */}
          {farmer && (
            <div className="bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition-shadow duration-300">
              <div className="bg-gradient-to-r from-green-500 to-green-600 p-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold text-white">Farmer Details</h2>
                  <User className="w-6 h-6 text-white" />
                </div>
              </div>
              <div className="p-6 space-y-4">
                <div className="flex items-start">
                  <User className="w-5 h-5 text-gray-400 mt-0.5 mr-3 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Name</p>
                    <p className="text-gray-800 font-semibold">{farmer.farmerName}</p>
                  </div>
                </div>
                <div className="flex items-start">
                  <MapPin className="w-5 h-5 text-gray-400 mt-0.5 mr-3 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Location</p>
                    <p className="text-gray-800 font-semibold">{farmer.location}</p>
                  </div>
                </div>
                <div className="flex items-start">
                  <Package className="w-5 h-5 text-gray-400 mt-0.5 mr-3 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Crop Type</p>
                    <p className="text-gray-800 font-semibold">{farmer.cropType}</p>
                  </div>
                </div>
                <div className="flex items-start">
                  <Package className="w-5 h-5 text-gray-400 mt-0.5 mr-3 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Quantity</p>
                    <p className="text-gray-800 font-semibold">{farmer.quantity.toString()} units</p>
                  </div>
                </div>
                <div className="flex items-start">
                  <DollarSign className="w-5 h-5 text-gray-400 mt-0.5 mr-3 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Total Price</p>
                    <p className="text-2xl text-green-600 font-bold">{web3.utils.fromWei(farmer.totalPrice, "ether")} ETH</p>
                  </div>
                </div>
                <div className="pt-4 border-t border-gray-200">
                  <div className="flex items-center">
                    {farmer.isSold ? (
                      <>
                        <CheckCircle className="w-5 h-5 text-green-500 mr-2" />
                        <span className="text-sm text-green-600 font-semibold">Sold</span>
                      </>
                    ) : (
                      <>
                        <XCircle className="w-5 h-5 text-amber-500 mr-2" />
                        <span className="text-sm text-amber-600 font-semibold">Available</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* FPO Card */}
          {fpo && fpo.fpoWallet !== "0x0000000000000000000000000000000000000000" && (
            <div className="bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition-shadow duration-300">
              <div className="bg-gradient-to-r from-blue-500 to-blue-600 p-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold text-white">FPO Details</h2>
                  <Building2 className="w-6 h-6 text-white" />
                </div>
              </div>
              <div className="p-6 space-y-4">
                <div className="flex items-start">
                  <Building2 className="w-5 h-5 text-gray-400 mt-0.5 mr-3 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Organization</p>
                    <p className="text-gray-800 font-semibold">{fpo.fpoName}</p>
                  </div>
                </div>
                <div className="flex items-start">
                  <MapPin className="w-5 h-5 text-gray-400 mt-0.5 mr-3 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Location</p>
                    <p className="text-gray-800 font-semibold">{fpo.fpoLocation}</p>
                  </div>
                </div>
                <div className="flex items-start">
                  <Package className="w-5 h-5 text-gray-400 mt-0.5 mr-3 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Agmark Number</p>
                    <p className="text-gray-800 font-semibold">{fpo.agmarkNumber}</p>
                  </div>
                </div>
                <div className="flex items-start">
                  <Package className="w-5 h-5 text-gray-400 mt-0.5 mr-3 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide">FSSAI License</p>
                    <p className="text-gray-800 font-semibold">{fpo.fssaiLicenseNumber}</p>
                  </div>
                </div>
                <div className="flex items-start">
                  <DollarSign className="w-5 h-5 text-gray-400 mt-0.5 mr-3 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Agreed Price</p>
                    <p className="text-2xl text-blue-600 font-bold">{web3.utils.fromWei(fpo.agreedPrice, "ether")} ETH</p>
                  </div>
                </div>
                <div className="pt-4 border-t border-gray-200">
                  <div className="flex items-center">
                    {fpo.hasPaid ? (
                      <>
                        <CheckCircle className="w-5 h-5 text-green-500 mr-2" />
                        <span className="text-sm text-green-600 font-semibold">Payment Completed</span>
                      </>
                    ) : (
                      <>
                        <XCircle className="w-5 h-5 text-amber-500 mr-2" />
                        <span className="text-sm text-amber-600 font-semibold">Payment Pending</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Retailer Card */}
          {retailer && retailer.retailerWallet !== "0x0000000000000000000000000000000000000000" && (
            <div className="bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition-shadow duration-300">
              <div className="bg-gradient-to-r from-purple-500 to-purple-600 p-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold text-white">Retailer Details</h2>
                  <Store className="w-6 h-6 text-white" />
                </div>
              </div>
              <div className="p-6 space-y-4">
                <div className="flex items-start">
                  <Store className="w-5 h-5 text-gray-400 mt-0.5 mr-3 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Retailer Name</p>
                    <p className="text-gray-800 font-semibold">{retailer.retailerName}</p>
                  </div>
                </div>
                <div className="flex items-start">
                  <MapPin className="w-5 h-5 text-gray-400 mt-0.5 mr-3 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Location</p>
                    <p className="text-gray-800 font-semibold">{retailer.retailerLocation}</p>
                  </div>
                </div>
                <div className="flex items-start">
                  <DollarSign className="w-5 h-5 text-gray-400 mt-0.5 mr-3 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Agreed Price</p>
                    <p className="text-2xl text-purple-600 font-bold">{web3.utils.fromWei(retailer.agreedPrice, "ether")} ETH</p>
                  </div>
                </div>
                <div className="pt-4 border-t border-gray-200">
                  <div className="flex items-center">
                    {retailer.hasPaid ? (
                      <>
                        <CheckCircle className="w-5 h-5 text-green-500 mr-2" />
                        <span className="text-sm text-green-600 font-semibold">Payment Completed</span>
                      </>
                    ) : (
                      <>
                        <XCircle className="w-5 h-5 text-amber-500 mr-2" />
                        <span className="text-sm text-amber-600 font-semibold">Payment Pending</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}