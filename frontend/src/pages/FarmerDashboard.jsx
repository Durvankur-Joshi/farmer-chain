import React, { useState, useEffect } from "react";
import axios from "axios";
import Cookies from "js-cookie";
import { useNavigate } from "react-router-dom";

export default function FarmerDashboard() {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    product_name: "",
    category: "",
    description: "",
    quantity: "",
    unit: "",
    deadline: "",
  });

  const [errors, setErrors] = useState({});
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);

  // 🔹 Logout function
  const logout = async () => {
  try {
    await axios.post("/api/logout/", {}, { withCredentials: true });
  } catch (err) {
    console.error("Logout error:", err);
  } finally {
    Cookies.remove("role", { path: "/" }); // remove non-HttpOnly role cookie
    navigate("/");
  }
};


  // Fetch past history on mount
  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await axios.get("/api/farmer/quotes/", {
          withCredentials: true,
        });
        console.log("Fetched history:", res.data);
        
        setHistory(res.data);
      } catch (err) {
        console.error("Error fetching history:", err);
      }
    };
    fetchHistory();
  }, []);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setErrors({ ...errors, [e.target.name]: "" });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await axios.post("/api/farmer/quotes/", formData, {
        withCredentials: true,
      });
      alert("✅ Product posted successfully!");
      setFormData({
        product_name: "",
        category: "",
        description: "",
        quantity: "",
        unit: "",
        deadline: "",
      });
      const res = await axios.get("/api/farmer/quotes/", {
        withCredentials: true,
      });
      setHistory(res.data);
    } catch (err) {
      if (err.response?.data) {
        setErrors(err.response.data);
      } else {
        console.error("Error posting product:", err);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Top Bar with Logout */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-green-700">🌾 Farmer Dashboard</h1>
        <button
          onClick={logout}
          className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
        >
          Logout
        </button>
      </div>

      {/* Farmer Quote Section */}
      <div className="bg-green-100 p-6 rounded-2xl shadow mb-6 text-center">
        <h2 className="text-2xl font-bold text-green-800">
          🌱 “The farmer is the backbone of our nation.”
        </h2>
        <p className="text-gray-700 mt-2">
          Nurturing the land, feeding the world. 🙌
        </p>
      </div>

      {/* Product Posting Form */}
      <form
        onSubmit={handleSubmit}
        className="bg-white p-6 rounded-2xl shadow mb-6 space-y-4"
      >
        <h3 className="text-xl font-semibold mb-2">🚜 Post Your Product</h3>

        {/* Product Name */}
        <div>
          <label className="block text-gray-700 mb-1">Product Name</label>
          <input
            type="text"
            name="product_name"
            placeholder="e.g. Organic Wheat"
            value={formData.product_name}
            onChange={handleChange}
            className="w-full border p-2 rounded focus:ring-2 focus:ring-green-400 outline-none"
          />
          {errors.product_name && (
            <p className="text-red-500 text-sm">{errors.product_name[0]}</p>
          )}
        </div>

        {/* Category & Unit */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-gray-700 mb-1">Category</label>
            <select
              name="category"
              value={formData.category}
              onChange={handleChange}
              className="w-full border p-2 rounded focus:ring-2 focus:ring-green-400 outline-none"
            >
              <option value="">Select Category</option>
              <option value="Grains">Grains</option>
              <option value="Vegetables">Vegetables</option>
              <option value="Fruits">Fruits</option>
              <option value="Dairy">Dairy</option>
            </select>
            {errors.category && (
              <p className="text-red-500 text-sm">{errors.category[0]}</p>
            )}
          </div>

          <div>
            <label className="block text-gray-700 mb-1">Unit</label>
            <select
              name="unit"
              value={formData.unit}
              onChange={handleChange}
              className="w-full border p-2 rounded focus:ring-2 focus:ring-green-400 outline-none"
            >
              <option value="">Select Unit</option>
              <option value="kg">Kilogram (kg)</option>
              <option value="quintal">Quintal</option>
              <option value="ton">Ton</option>
              <option value="litre">Litre</option>
            </select>
            {errors.unit && (
              <p className="text-red-500 text-sm">{errors.unit[0]}</p>
            )}
          </div>
        </div>

        {/* Quantity */}
        <div>
          <label className="block text-gray-700 mb-1">Quantity</label>
          <input
            type="number"
            name="quantity"
            placeholder="e.g. 100"
            value={formData.quantity}
            onChange={handleChange}
            className="w-full border p-2 rounded focus:ring-2 focus:ring-green-400 outline-none"
          />
          {errors.quantity && (
            <p className="text-red-500 text-sm">{errors.quantity[0]}</p>
          )}
        </div>

        {/* Deadline */}
        <div>
          <label className="block text-gray-700 mb-1">Deadline</label>
          <input
            type="date"
            name="deadline"
            value={formData.deadline}
            onChange={handleChange}
            className="w-full border p-2 rounded focus:ring-2 focus:ring-green-400 outline-none"
          />
          {errors.deadline && (
            <p className="text-red-500 text-sm">{errors.deadline[0]}</p>
          )}
        </div>

        {/* Description */}
        <div>
          <label className="block text-gray-700 mb-1">Description</label>
          <textarea
            name="description"
            placeholder="Write details about your product..."
            value={formData.description}
            onChange={handleChange}
            className="w-full border p-2 rounded h-24 resize-none focus:ring-2 focus:ring-green-400 outline-none"
          />
          {errors.description && (
            <p className="text-red-500 text-sm">{errors.description[0]}</p>
          )}
        </div>

        <button
          type="submit"
          disabled={loading}
          className={`w-full py-2 rounded text-white ${
            loading ? "bg-gray-400" : "bg-green-600 hover:bg-green-700"
          }`}
        >
          {loading ? "Posting..." : "✅ Post Product"}
        </button>
      </form>

      {/* Past History */}
      <div className="bg-white p-6 rounded-2xl shadow">
        <h3 className="text-xl font-semibold mb-4">📜 Past Product History</h3>
        {history.length > 0 ? (
          <ul className="space-y-3">
            {history.map((item, index) => (
              <li key={index} className="border p-3 rounded-lg">
                <p>
                  <strong>{item.product_name}</strong> ({item.category})
                </p>
                <p className="text-gray-600">{item.description}</p>
                <p>
                  Qty: {item.quantity} {item.unit}
                </p>
                <p className="text-sm text-gray-500">
                  Deadline: {item.deadline}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-gray-500">No past products yet.</p>
        )}
      </div>
    </div>
  );
}
