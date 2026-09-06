import React, { useState } from "react";

function shorten(str, start = 6, end = 4) {
  if (!str) return "—";
  if (str.length <= start + end + 3) return str;
  return `${str.slice(0, start)}…${str.slice(-end)}`;
}

export default function AddressCopy({
  value,
  address,
  truncateLength,
  label,
  etherscanType = null, // 'address' | 'tx'
  truncate = true,
  className = "",
}) {
  const [copied, setCopied] = useState(false);

  const actualValue = value || address;

  if (!actualValue) return <span className="text-slate-400 font-mono text-xs">—</span>;

  const handleCopy = (e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(actualValue).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  };

  let displayText = actualValue;
  if (truncateLength && actualValue.length > truncateLength) {
    const half = Math.max(3, Math.floor((truncateLength - 3) / 2));
    displayText = shorten(actualValue, half, half);
  } else if (truncate) {
    displayText = shorten(actualValue);
  }

  const etherscanUrl = etherscanType
    ? `https://sepolia.etherscan.io/${etherscanType}/${actualValue}`
    : null;

  return (
    <span className={`inline-flex items-center gap-1.5 font-mono text-xs max-w-full min-w-0 ${className}`}>
      {label && <span className="font-sans font-medium text-slate-500 shrink-0">{label}:</span>}
      {etherscanUrl ? (
        <a
          href={etherscanUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:text-blue-700 hover:underline transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500 rounded truncate min-w-0"
          title={`View on Sepolia Etherscan: ${actualValue}`}
          aria-label={`View on Sepolia Etherscan for ${actualValue}`}
        >
          {displayText}
        </a>
      ) : (
        <span className={`text-slate-800 ${truncate ? "truncate" : "break-all"} min-w-0`} title={actualValue}>
          {displayText}
        </span>
      )}
      <button
        type="button"
        onClick={handleCopy}
        className="p-1 text-slate-400 hover:text-slate-700 rounded-md hover:bg-slate-100 transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-400 shrink-0"
        title="Copy full value to clipboard"
        aria-label="Copy to clipboard"
      >
        {copied ? (
          <span className="text-emerald-600 font-sans font-bold text-[10px] animate-fade-in">✓</span>
        ) : (
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
        )}
      </button>
    </span>
  );
}
