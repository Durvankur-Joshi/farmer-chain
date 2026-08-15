# FarmerChain 🌾⛓️

**FarmerChain** is a blockchain-based agricultural supply-chain platform designed to connect **Farmers, Farmer Producer Organizations (FPOs), and Retailers** through a transparent, traceable, and digitally verifiable workflow.

The platform combines **W3C DIDs, digital crop passports, AI-assisted crop image quality verification, marketplace counter-offer negotiation, Ethereum Sepolia smart contracts, and escrow-based payments** to create a trusted, end-to-end journey for agricultural products from the farmer to the retail buyer.

---

## 🚀 What Problem Are We Solving?

Agricultural supply chains often have fragmented information about:

- Where a crop originated from
- Which farmer cultivated it
- What quantity is available in stock
- Whether the crop quality can be verified
- How prices were negotiated between parties
- Whether payment was actually secured in escrow
- What happens to provenance when stock moves between supply-chain participants

When products move between multiple participants, provenance information can easily disappear.

FarmerChain addresses this by creating a **digital identity, provenance chain, and traceable transaction history for agricultural products**.

---

# 💡 Complete End-to-End Business Architecture

FarmerChain connects all three participants in a single, unified supply chain:

```text
Farmer
   │
   ├── 1. Registration + W3C DID + Sepolia Wallet
   ├── 2. Create Crop Passport (Cultivation, Harvest, Image)
   ├── 3. AI Quality Verification (Grade A/B/C)
   ├── 4. Publish Supply Quote / Listing
   │
   ▼
Farmer Producer Organization (FPO)
   │
   ├── 5. Review Farmer Quotes & Provenance
   ├── 6. Place Procurement Bid / Counter-Offer Negotiation
   ├── 7. Agreement Lock & Sepolia Smart Contract Escrow Creation
   ├── 8. FPO Deposits ETH in Escrow (Sepolia)
   ├── 9. Farmer Confirms Delivery ➔ FPO Releases Payment
   ├── 10. Stock Enters FPO Inventory Lot (Retaining Farmer Provenance)
   ├── 11. Select Available Stock ➔ Create Wholesale Retailer Bid / Market Quote
   │
   ▼
Retailer
   │
   ├── 12. Browse FPO Market Quotes & Provenance Breakdown
   ├── 13. Add Stock Quantity to Cart or Submit Procurement Bid
   ├── 14. Real-time Counter-Offer Negotiation & Chat
   ├── 15. Agreement Lock & Sepolia Smart Contract Escrow Creation
   ├── 16. Retailer Deposits ETH in Escrow (Sepolia)
   ├── 17. FPO Confirms Bulk Delivery ➔ Retailer Releases Payment
   └── 18. Stock Enters Purchased Retailer Inventory (End-to-End Provenance Retained)
```

---

## 🛠️ Technology Stack

- **Frontend**: React (Vite), TailwindCSS, Axios, Ethers.js v5, Lucide / HeroIcons, W3C DID helpers
- **Backend**: Python 3.11, Django, Django REST Framework, SQLite / PostgreSQL
- **Blockchain**: Solidity (`FarmerChainEscrow.sol`), Ethereum Sepolia Testnet, MetaMask
- **Identity & Verification**: W3C DID (Decentralized Identity), AI Quality Assessment Service

---

## 🔐 Escrow Smart Contract Workflow

Both **Farmer ↔ FPO** and **FPO ↔ Retailer** deals execute through the deployed `FarmerChainEscrow.sol` smart contract on Ethereum Sepolia:

1. **Created** (`0`): Escrow agreement initialized with payer, beneficiary, quote reference ID, and total ETH value.
2. **Funded** (`1`): Buyer deposits negotiated ETH into the smart contract via MetaMask.
3. **Delivery Confirmed** (`2`): Seller confirms physical crop delivery.
4. **Released** (`3`): Buyer releases payment, automatically transferring ETH to seller's wallet on-chain.

---

## 🏃 Quickstart / Local Development

### 1. Backend Setup
```bash
cd backend
python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

### 2. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

Visit `http://localhost:5173/` in your browser.

---

## 📜 License
MIT License. Created for transparent, verifiable agricultural trade.
