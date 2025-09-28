// src/pages/AuthForm.jsx
import React, { useState } from "react";
import axios from "axios";
import Cookies from "js-cookie";
import { useNavigate } from "react-router-dom";

export default function AuthForm() {
  const [isLogin, setIsLogin] = useState(true);
  const navigate = useNavigate();
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
    role: "farmer",
  });

  const [pendingApproval, setPendingApproval] = useState(false);

  const handleRoleChange = (e) => {
    setRole(e.target.value);
    setFormData({ ...formData, role: e.target.value });
  };

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

  const handleSubmit = async (e) => {
    e.preventDefault();

    let endpoint = "";
    let payload = {};

    // Configure axios to include credentials (cookies)
    axios.defaults.withCredentials = true;

    if (isLogin) {
      endpoint = "/api/token/";
      payload = {
        username: formData.email,
        password: formData.password,
        role: formData.role,
      };
    } else {
      if (role === "farmer") endpoint = "/api/farmer/register/";
      if (role === "fpo") endpoint = "/api/fpo/register/";
      if (role === "retailer") endpoint = "/api/retailer/register/";
      payload = formData;
    }

    try {
      const res = await axios.post(endpoint, payload, {
        withCredentials: true, // Ensure cookies are sent and received
      });

      console.log("Success:", res.data);

      // For login, the tokens will be automatically stored in cookies by the browser
      if (isLogin) {
        Cookies.set("role", res.data.role, { path: "/" }); // Save role
        alert("Login successful! Redirecting...");

        // Redirect based on role
        if (formData.role === "farmer") navigate("/farmer-dashboard");
        if (formData.role === "fpo") navigate("/fpo-dashboard");
        if (formData.role === "retailer") navigate("/retailer-dashboard");
        if (formData.role === "admin") navigate("/admin-dashboard");
      } else {
        alert("Registration successful! Check console.");
      }
    } catch (err) {
      console.error("Error:", err.response?.data || err.message);
      const errorMsg = err.response?.data?.error || err.message;
      if (errorMsg.includes("Account pending admin approval")) {
        setPendingApproval(true);
      } else {
        alert("Error! Check console.");
      }
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      {pendingApproval && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white p-6 rounded-lg shadow-lg w-80 text-center">
            <h3 className="text-lg font-bold mb-2">Pending Approval</h3>
            <p className="mb-4">
              Your account is pending admin approval. Please try again later.
            </p>
            <button
              onClick={() => setPendingApproval(false)}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            >
              OK
            </button>
          </div>
        </div>
      )}

      <div className="w-full max-w-md p-6 bg-white rounded-lg shadow-lg">
        <h2 className="text-2xl font-bold mb-4 text-center">
          {isLogin ? "Login" : "Register"} as {role.toUpperCase()}
        </h2>

        <select
          value={role}
          onChange={handleRoleChange}
          className="w-full p-2 mb-4 border rounded"
        >
          <option value="farmer">Farmer</option>
          <option value="fpo">FPO</option>
          <option value="retailer">Retailer</option>
        </select>

        <form onSubmit={handleSubmit} className="space-y-3">
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
