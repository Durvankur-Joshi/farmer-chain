/**
 * Units and Pricing Consistency Utility for FarmerChain.
 * Handles standardized units, price formatting, and decimal-safe total calculations in ETH.
 */

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
 * Calculates total ETH amount from price per unit and quantity with IEEE-754 precision correction.
 * Example: 10 kg * 0.01 ETH/kg = 0.1 ETH.
 * Example: 10 kg * 0.10 ETH/kg = 1.0 ETH.
 * 
 * @param {number|string} price - Price per unit in ETH
 * @param {number|string} quantity - Quantity
 * @returns {string|null} - Formatted total in ETH, or null if inputs are invalid/non-positive
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

  // Prevent floating point errors (e.g. 0.1 * 10 = 0.9999999999999999 or 0.1 * 0.2 = 0.020000000000000004)
  const total = p * q;
  // Safe decimal string representation up to 8 decimals without extraneous scientific notation for normal trade ranges
  const safeStr = parseFloat(total.toFixed(8)).toString();
  return safeStr;
};

/**
 * Formats a unit price string as "<price> ETH / <unit>"
 * @param {number|string} price 
 * @param {string} unit 
 * @returns {string}
 */
export const formatPricePerUnit = (price, unit = "unit") => {
  if (price === undefined || price === null || price === "") return "";
  return `${price} ETH / ${unit}`;
};
