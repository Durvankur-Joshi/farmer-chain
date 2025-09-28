import React, { useState } from "react";
import FarmerQuotes from "../../components/fpo/FarmerQuotes";
import RetailerQuotes from "../../components/fpo/RetailerQuotes";

export default function FpoDashboard() {
  const [activeTab, setActiveTab] = useState("farmer");

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Top Bar */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-blue-700">🏢 FPO Dashboard</h1>
      </div>

      {/* Tabs */}
      <div className="flex space-x-4 mb-6">
        <button
          className={`px-4 py-2 rounded ${
            activeTab === "farmer" ? "bg-blue-600 text-white" : "bg-gray-200"
          }`}
          onClick={() => setActiveTab("farmer")}
        >
          Farmer Quotes
        </button>
        <button
          className={`px-4 py-2 rounded ${
            activeTab === "retailer" ? "bg-blue-600 text-white" : "bg-gray-200"
          }`}
          onClick={() => setActiveTab("retailer")}
        >
          Retailer Quotes
        </button>
      </div>

      {/* Content */}
      {activeTab === "farmer" ? <FarmerQuotes /> : <RetailerQuotes />}
    </div>
  );
}
