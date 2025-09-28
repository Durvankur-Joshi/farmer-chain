import React, { useState } from "react";
import axios from "axios";

export default function QuoteForm({ onSuccess }) {
  const [formData, setFormData] = useState({
    product_name: "",
    category: "",
    description: "",
    quantity: "",
    unit: "",
    deadline: "",
  });

  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

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
      onSuccess(); // 🔹 Notify parent to refresh history
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
  );
}
