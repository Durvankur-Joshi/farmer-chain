/**
 * Units and Pricing Consistency Utility for FarmerChain 2.0 (Phase B).
 * Handles standardized units, commercial INR pricing, Sepolia ETH settlement conversion,
 * and decimal-safe calculations.
 */

// Demo testnet oracle exchange rate: 1 ETH = ₹250,000 INR (~$3,000 USD / ETH)
export const DEFAULT_INR_PER_ETH = 250000;

export const SUPPORTED_UNITS = [
  { value: "kg", label: "Kilogram (kg)" },
  { value: "quintal", label: "Quintal (quintal)" },
  { value: "caret", label: "Caret (caret)" },
  { value: "piece", label: "Piece (piece)" },
  { value: "acre", label: "Acre (acre)" },
  { value: "ton", label: "Metric Ton (ton)" },
  { value: "litre", label: "Litre (litre)" },
  { value: "dozen", label: "Dozen (dozen)" },
];

/**
 * Format an amount in Indian Rupees (₹) using Indian numbering system.
 * @param {number|string} amount
 * @param {boolean} includeDecimals
 * @returns {string} e.g. "₹1,200" or "₹1,200.50"
 */
export const formatInr = (amount, includeDecimals = false) => {
  if (amount === undefined || amount === null || amount === "") return "₹0";
  const num = parseFloat(amount);
  if (isNaN(num)) return "₹0";

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: includeDecimals ? 2 : 0,
    minimumFractionDigits: includeDecimals && num % 1 !== 0 ? 2 : 0,
  }).format(num);
};

/**
 * Format an amount in ETH.
 * @param {number|string} amount
 * @param {number} decimals
 * @returns {string} e.g. "0.0048 ETH"
 */
export const formatEth = (amount, decimals = 6) => {
  if (amount === undefined || amount === null || amount === "") return "0 ETH";
  const num = parseFloat(amount);
  if (isNaN(num)) return "0 ETH";
  const trimmed = parseFloat(num.toFixed(decimals));
  return `${trimmed} ETH`;
};

/**
 * Converts INR commercial amount to Sepolia ETH settlement.
 * @param {number|string} inrAmount
 * @param {number} rate
 * @returns {number}
 */
export const inrToEth = (inrAmount, rate = DEFAULT_INR_PER_ETH) => {
  const num = parseFloat(inrAmount);
  if (isNaN(num) || num <= 0) return 0;
  return parseFloat((num / rate).toFixed(6));
};

/**
 * Converts ETH settlement amount to INR commercial value.
 * @param {number|string} ethAmount
 * @param {number} rate
 * @returns {number}
 */
export const ethToInr = (ethAmount, rate = DEFAULT_INR_PER_ETH) => {
  const num = parseFloat(ethAmount);
  if (isNaN(num) || num <= 0) return 0;
  return parseFloat((num * rate).toFixed(2));
};

/**
 * Calculates total commercial INR value from price per unit and quantity.
 * @param {number|string} unitPrice
 * @param {number|string} quantity
 * @returns {number|null}
 */
export const calculateTotalInr = (unitPrice, quantity) => {
  if (
    unitPrice === undefined || unitPrice === null || unitPrice === "" ||
    quantity === undefined || quantity === null || quantity === ""
  ) {
    return null;
  }
  const p = parseFloat(unitPrice);
  const q = parseFloat(quantity);
  if (isNaN(p) || isNaN(q) || p <= 0 || q <= 0) return null;

  return parseFloat((p * q).toFixed(2));
};

/**
 * Formats a commercial unit price string.
 * Supports both INR (modern) and legacy testnet ETH amounts seamlessly.
 * @param {number|string} price
 * @param {string} unit
 * @returns {string} e.g. "₹120 / kg" or "0.001 ETH / kg (~₹250 / kg)"
 */
export const formatCommercialPrice = (price, unit = "kg") => {
  if (price === undefined || price === null || price === "") return "";
  const p = parseFloat(price);
  if (isNaN(p)) return "";

  if (p >= 1) {
    // Standard INR Commercial Pricing
    return `${formatInr(p)} / ${unit}`;
  } else {
    // Legacy ETH pricing with estimated INR equivalent
    const estInr = Math.round(p * DEFAULT_INR_PER_ETH);
    return `${p} ETH / ${unit} (~${formatInr(estInr)} / ${unit})`;
  }
};

/**
 * Provides a structured commercial pricing + blockchain settlement breakdown.
 * @param {number|string} unitPrice
 * @param {number|string} quantity
 * @param {string} unit
 * @returns {object|null}
 */
export const formatSettlementBreakdown = (unitPrice, quantity, unit = "kg") => {
  const p = parseFloat(unitPrice);
  const q = parseFloat(quantity);
  if (isNaN(p) || isNaN(q) || p <= 0 || q <= 0) return null;

  const isLegacyEth = p < 1;
  let totalInr = 0;
  let amountEth = 0;

  if (isLegacyEth) {
    amountEth = parseFloat((p * q).toFixed(6));
    totalInr = Math.round(amountEth * DEFAULT_INR_PER_ETH);
  } else {
    totalInr = parseFloat((p * q).toFixed(2));
    amountEth = parseFloat((totalInr / DEFAULT_INR_PER_ETH).toFixed(6));
  }

  return {
    quantity: q,
    unit,
    unitPrice: p,
    isLegacyEth,
    formattedUnitPrice: isLegacyEth ? `${p} ETH / ${unit}` : `${formatInr(p)} / ${unit}`,
    totalInr,
    formattedTotalInr: formatInr(totalInr),
    amountEth,
    formattedAmountEth: `${amountEth} ETH`,
    exchangeRateNote: `1 ETH = ₹${DEFAULT_INR_PER_ETH.toLocaleString("en-IN")} (Testnet Oracle Rate)`,
  };
};

/**
 * Backward compatibility helper for legacy ETH calculations.
 */
export const calculateTotalEth = (price, quantity) => {
  if (
    price === undefined ||
    price === null ||
    price === "" ||
    quantity === undefined ||
    quantity === null ||
    quantity === ""
  ) {
    return null;
  }

  const p = parseFloat(price);
  const q = parseFloat(quantity);

  if (isNaN(p) || isNaN(q) || p <= 0 || q <= 0) {
    return null;
  }

  const total = p * q;
  return parseFloat(total.toFixed(8)).toString();
};

/**
 * Backward compatibility helper for formatting price per unit.
 */
export const formatPricePerUnit = (price, unit = "unit") => {
  if (price === undefined || price === null || price === "") return "";
  const p = parseFloat(price);
  if (isNaN(p)) return "";
  if (p >= 1) {
    return `${formatInr(p)} / ${unit}`;
  }
  return `${price} ETH / ${unit}`;
};
