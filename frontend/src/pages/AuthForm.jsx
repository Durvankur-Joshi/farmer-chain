// src/components/AuthForm.jsx
import React, { useState } from "react";
import axios from "axios";

export default function AuthForm() {
  const [isLogin, setIsLogin] = useState(true);
  const [role, setRole] = useState("farmer");
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    aadhaar_number: "",
    corporate_identification_number: "",
    gstin: "",
    city: "",
    state: "",
    wallet_address: "",
  });

  // connect MetaMask
  const connectWallet = async () => {
    if (window.ethereum) {
      try {
        const accounts = await window.ethereum.request({
          method: "eth_requestAccounts",
        });
        setFormData({ ...formData, wallet_address: accounts[0] });
      } catch (error) {
        console.error("Wallet connection failed", error);
      }
    } else {
      alert("MetaMask not found! Please install it.");
    }
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // API call
  const handleSubmit = async (e) => {
    e.preventDefault();

    let endpoint = "";
    if (isLogin) {
      if (role === "farmer") endpoint = "/api/farmer/login-check/";
      if (role === "fpo") endpoint = "/api/fpo/login-check/";
      if (role === "retailer") endpoint = "/api/retailer/login-check/";
    } else {
      if (role === "farmer") endpoint = "/api/farmer/register/";
      if (role === "fpo") endpoint = "/api/fpo/register/";
      if (role === "retailer") endpoint = "/api/retailer/register/";
    }

    try {
      const res = await axios.post(endpoint, formData);
      console.log("Success:", res.data);
      alert("Success! Check console.");
    } catch (err) {
      console.error("Error:", err.response?.data || err.message);
      alert("Error! Check console.");
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <div className="w-full max-w-md p-6 bg-white rounded-lg shadow-lg">
        <h2 className="text-2xl font-bold mb-4 text-center">
          {isLogin ? "Login" : "Register"} as {role.toUpperCase()}
        </h2>

        {/* Toggle between roles */}
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="w-full p-2 mb-4 border rounded"
        >
          <option value="farmer">Farmer</option>
          <option value="fpo">FPO</option>
          <option value="retailer">Retailer</option>
        </select>

        <form onSubmit={handleSubmit} className="space-y-3">
          {/* Show signup fields */}
          {!isLogin && (
            <>
              <input
                type="text"
                name="name"
                placeholder="Name"
                onChange={handleChange}
                className="w-full p-2 border rounded"
                required
              />

              {role === "farmer" && (
                <input
                  type="text"
                  name="aadhaar_number"
                  placeholder="Aadhaar Number"
                  onChange={handleChange}
                  className="w-full p-2 border rounded"
                  required
                />
              )}

              {role === "fpo" && (
                <input
                  type="text"
                  name="corporate_identification_number"
                  placeholder="CIN"
                  onChange={handleChange}
                  className="w-full p-2 border rounded"
                  required
                />
              )}

              {role === "retailer" && (
                <input
                  type="text"
                  name="gstin"
                  placeholder="GSTIN"
                  onChange={handleChange}
                  className="w-full p-2 border rounded"
                  required
                />
              )}

              <input
                type="text"
                name="city"
                placeholder="City"
                onChange={handleChange}
                className="w-full p-2 border rounded"
                required
              />
              <input
                type="text"
                name="state"
                placeholder="State"
                onChange={handleChange}
                className="w-full p-2 border rounded"
                required
              />

              {/* Wallet connect */}
              <button
                type="button"
                onClick={connectWallet}
                className="w-full bg-purple-600 text-white py-2 rounded hover:bg-purple-700"
              >
                {formData.wallet_address
                  ? `Wallet: ${formData.wallet_address.substring(0, 10)}...`
                  : "Connect MetaMask"}
              </button>
            </>
          )}

          {/* Common fields */}
          <input
            type="email"
            name="email"
            placeholder="Email"
            onChange={handleChange}
            className="w-full p-2 border rounded"
            required
          />
          <input
            type="password"
            name="password"
            placeholder="Password"
            onChange={handleChange}
            className="w-full p-2 border rounded"
            required
          />

          <button
            type="submit"
            className="w-full bg-green-600 text-white py-2 rounded hover:bg-green-700"
          >
            {isLogin ? "Login" : "Register"}
          </button>
        </form>

        {/* Toggle login/register */}
        <p className="mt-4 text-center">
          {isLogin ? "Don't have an account?" : "Already have an account?"}{" "}
          <button
            className="text-blue-600 font-semibold"
            onClick={() => setIsLogin(!isLogin)}
          >
            {isLogin ? "Register" : "Login"}
          </button>
        </p>
      </div>
    </div>
  );
}
