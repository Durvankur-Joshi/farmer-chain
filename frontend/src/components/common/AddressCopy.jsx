import React, { useState } from "react";

function shorten(str, start = 6, end = 4) {
  if (!str) return "—";
  if (str.length <= start + end + 3) return str;
  return `${str.slice(0, start)}…${str.slice(-end)}`;
}

export default function AddressCopy({
  value,
  label,
  etherscanType = null, // 'address' | 'tx'
  truncate = true,
  className = "",
}) {
  const [copied, setCopied] = useState(false);

  if (!value) return <span className="text-gray-400 font-mono text-xs">—</span>;

  const handleCopy = (e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  };

  const displayText = truncate ? shorten(value) : value;
  const etherscanUrl = etherscanType
    ? `https://sepolia.etherscan.io/${etherscanType}/${value}`
    : null;

  return (
    <span className={`inline-flex items-center gap-1.5 font-mono text-xs ${className}`}>
      {label && <span className="font-sans font-medium text-gray-500">{label}:</span>}
      {etherscanUrl ? (
        <a
          href={etherscanUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:text-blue-800 hover:underline transition-colors"
          title={`View on Sepolia Etherscan: ${value}`}
        >
          {displayText}
        </a>
      ) : (
        <span className="text-gray-800" title={value}>
          {displayText}
        </span>
      )}
      <button
        type="button"
        onClick={handleCopy}
        className="p-1 text-gray-400 hover:text-gray-700 rounded hover:bg-gray-100 transition-all"
        title="Copy to clipboard"
      >
        {copied ? (
          <span className="text-emerald-600 font-sans font-semibold text-[10px]">✓</span>
        ) : (
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
        )}
      </button>
    </span>
  );
}
