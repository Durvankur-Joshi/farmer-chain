import React from "react";

export default function QuoteHistory({ history, onViewBids }) {
  return (
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
              <button
                onClick={() => onViewBids(item)}
                className="mt-2 bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700"
              >
                👀 View Bids
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-gray-500">No past products yet.</p>
      )}
    </div>
  );
}
