# FarmerChain 🌾⛓️

**FarmerChain** is a blockchain-based agricultural supply-chain platform designed to connect **Farmers, Farmer Producer Organizations (FPOs), and Retailers** through a transparent, traceable, and digitally verifiable workflow.

The platform combines **digital crop passports, AI-assisted crop image verification, decentralized evidence, marketplace negotiation, Ethereum Sepolia smart contracts, and escrow-based payments** to create a trusted journey for agricultural products from the farmer to the buyer.

> **Hackathon Demo Focus:** The current demonstrated flow focuses primarily on **Farmer → FPO**. The **FPO → Retailer** marketplace, inventory, cart, chat, negotiation, payment, and delivery extensions are being developed as the next stage of the platform.

---

## 🚀 What Problem Are We Solving?

Agricultural supply chains often have fragmented information about:

- Where a crop came from
- Which farmer produced it
- What quantity is actually available
- Whether the crop information can be verified
- How prices were negotiated
- Whether payment was actually secured
- What happens to the crop after it moves between supply-chain participants

When products move between multiple participants, provenance information can easily disappear.

FarmerChain addresses this by creating a **digital identity and traceable transaction history for agricultural products**.

---

# 💡 Our Solution

FarmerChain creates a connected digital workflow:

```text
Farmer
   │
   ├── Registration + Wallet
   │
   ▼
Crop Passport
   │
   ├── Crop Information
   ├── Crop Image
   ├── AI Verification
   └── Evidence
   │
   ▼
Farmer Crop Listing
   │
   ▼
FPO
   │
   ├── View Crop + Provenance
   ├── Bid / Counter-Bid
   └── Accept Agreement
   │
   ▼
Blockchain Escrow
   │
   ├── Smart Contract
   ├── Sepolia Transaction
   └── Locked Payment
   │
   ▼
Delivery Confirmation
   │
   ▼
Payment Release
```

The next stage extends this to:

```text
Farmer
   ↓
FPO Inventory
   ↓
FPO Stock Cart
   ↓
Retailer Market Quote
   ↓
Retailer Cart
   ↓
Negotiation
   ↓
Escrow / Payment
   ↓
Delivery
```

---

# ✨ Core Features

## 1. Farmer Registration

Farmers can create an account and connect their **MetaMask wallet**.

The wallet provides the blockchain identity used for on-chain operations.

The application also supports an approval flow before the farmer can use the full platform.

---

## 2. Digital Crop Passport

A farmer can create a digital passport for a crop.

The passport contains information such as:

- Crop name
- Crop category
- Quantity
- Unit
- Location
- Cultivation date
- Harvest date
- Crop image
- Verification information
- Supporting evidence where available

The passport acts as the digital identity of the crop.

The objective is to keep crop information and its provenance connected throughout the supply chain.

---

## 3. AI-Assisted Crop Image Verification

The crop registration flow includes image verification.

The farmer uploads a crop image during registration, and the image can be used for the platform's AI-assisted verification process.

The verified image is associated with the crop record so that downstream participants can better understand the product being offered.

---

## 4. Decentralized Evidence

The platform supports decentralized evidence associated with crop records.

Evidence can provide additional information for buyers and FPOs when evaluating a crop.

The system is designed so that evidence is supplementary to the core crop information and can strengthen trust and understanding of the crop's history.

---

## 5. Farmer → FPO Marketplace

Farmers can make their crops available to FPOs by providing:

- Crop
- Quantity
- Unit
- Asking price
- Related crop passport

The FPO can then discover available crops and review their associated information.

---

## 6. Price Negotiation

The Farmer → FPO flow supports negotiated pricing.

The basic workflow is:

```text
Farmer Asking Price
       ↓
FPO Bid
       ↓
Farmer Counter Offer
       ↓
FPO Counter Offer
       ↓
Agreement
```

The objective is to provide a digital record of the commercial negotiation rather than treating the final price as an unexplained number.

---

## 7. Blockchain Escrow

After the Farmer and FPO agree on the transaction, the platform can create an on-chain escrow on **Ethereum Sepolia**.

The workflow is:

```text
Accepted Quote
     ↓
Create Smart Escrow
     ↓
MetaMask Confirmation
     ↓
EscrowCreated Event
     ↓
On-Chain Escrow ID
     ↓
FPO Deposits ETH
     ↓
Payment Locked
```

The smart contract provides a trust-minimized payment mechanism.

The application keeps the database transaction connected to the corresponding blockchain transaction.

---

## 8. MetaMask Integration

MetaMask is used for blockchain transactions.

Examples include:

- Connecting the user's wallet
- Creating an escrow
- Depositing escrow funds
- Confirming blockchain transactions

The platform uses **Sepolia**, an Ethereum test network, for development and demonstration.

No real production funds should be used for the hackathon demo.

---

## 9. Delivery and Payment Release

After the agricultural product is delivered, the delivery confirmation workflow can trigger the next stage of the escrow lifecycle.

Conceptually:

```text
Escrow Created
      ↓
FPO Funds Escrow
      ↓
Crop Delivered
      ↓
Delivery Confirmed
      ↓
Payment Released
      ↓
Farmer Receives Payment
```

This connects the commercial transaction with the blockchain payment lifecycle.

---

# 🏢 FPO Inventory & Provenance — Next Stage

A major planned enhancement is a provenance-preserving **FPO Inventory system**.

This solves an important supply-chain problem.

For example, an FPO may have:

```text
Farmer A → 15 kg Rice
Farmer B → 15 kg Rice
Farmer C → 20 kg Rice
```

The FPO has **50 kg Rice**, but the system must not lose the source information.

Instead, inventory remains separated into traceable lots:

```text
Inventory Lot A
15 kg
Farmer A
Crop Passport A

Inventory Lot B
15 kg
Farmer B
Crop Passport B

Inventory Lot C
20 kg
Farmer C
Crop Passport C
```

The FPO can later select partial quantities.

For example:

```text
Farmer A: 15 kg available
FPO selects: 10 kg
Remaining: 5 kg
```

The remaining 5 kg stays in FPO inventory.

This allows the future retailer transaction to maintain the complete provenance chain.

---

# 🛒 FPO Stock Cart — Planned

The FPO Stock Cart will allow an FPO to select stock from multiple inventory lots.

Example:

| Source | Available | Selected |
|---|---:|---:|
| Farmer A | 15 kg | 10 kg |
| Farmer B | 15 kg | 15 kg |
| Farmer C | 20 kg | 20 kg |
| **Total** | **50 kg** | **45 kg** |

The market quote will be generated from the actual available FPO stock rather than from an arbitrary quantity.

---

# 🏪 FPO → Retailer Marketplace — Planned

The next major marketplace stage connects FPOs with retailers.

A retailer can request agricultural products from an FPO.

The resulting market quote will preserve:

```text
Retailer
   ↓
FPO
   ↓
FPO Inventory Lot
   ↓
Farmer
   ↓
Crop
   ↓
Crop Passport
```

If multiple farmers contribute to a single retailer quote, **all contributing farmers and crop passports remain traceable**.

Example:

```text
Retailer Order
50 kg Rice
      │
      ├── 10 kg → Farmer A → Passport A
      ├── 15 kg → Farmer B → Passport B
      └── 25 kg → Farmer C → Passport C
```

This prevents provenance from disappearing when stock is aggregated.

---

# 🛍️ Retailer Cart — Planned

Retailers will have their own cart.

The retailer cart will show:

- Product
- Quantity
- Unit
- FPO
- Farmer source
- Crop passport
- Asking price
- Negotiated price
- Availability

The system will prevent a retailer from purchasing more stock than is available.

---

# 💬 Communication & Negotiation — Planned

The platform is being extended with contextual conversations:

### Farmer ↔ FPO

Used for:

- Crop discussions
- Price negotiation
- Counter offers
- Transaction communication

### FPO ↔ Retailer

Used for:

- Product discussions
- Price negotiation
- Counter offers
- Order communication

Negotiation is designed to support multiple rounds:

```text
Offer
 ↓
Counter Offer
 ↓
Counter Offer
 ↓
Accept
```

Participants can also reject, withdraw, or end a negotiation.

The objective is to preserve the negotiation history instead of overwriting previous prices.

---

# 🔗 Full Traceability Vision

The long-term transaction chain is:

```text
                 CROP PASSPORT
                      │
                      ▼
                   FARMER
                      │
                Farmer ↔ FPO
                Quote / Bid
                      │
                      ▼
                FPO INVENTORY
                      │
                Stock Cart
                      │
                      ▼
                MARKET QUOTE
                      │
                      ▼
                RETAILER CART
                      │
               FPO ↔ Retailer
               Negotiation
                      │
                      ▼
                    ORDER
                      │
                      ▼
               BLOCKCHAIN ESCROW
                      │
                      ▼
                  DELIVERY
                      │
                      ▼
               PAYMENT RELEASE
```

The key principle is:

> **Aggregation should never destroy provenance.**

---

# 🧱 Technology Stack

## Frontend

- React
- Vite
- Axios
- Modern responsive UI
- MetaMask / browser wallet integration
- Ethers.js

## Backend

- Python
- Django
- Django REST Framework
- SQLite during development

## Blockchain

- Ethereum
- Sepolia testnet
- Solidity smart contracts
- MetaMask
- Ethers.js

## Decentralized Storage / Evidence

- IPFS-based evidence architecture

## AI

- AI-assisted crop image verification

---

# 🏗️ High-Level Architecture

```text
┌─────────────────────────────┐
│          React UI           │
│ Farmer / FPO / Retailer     │
└──────────────┬──────────────┘
               │ REST API
               ▼
┌─────────────────────────────┐
│      Django REST API        │
│ Authentication              │
│ Crop Passports              │
│ Quotes / Bids               │
│ Inventory                   │
│ Transactions                │
└───────┬───────────────┬─────┘
        │               │
        ▼               ▼
┌──────────────┐  ┌──────────────┐
│   Database   │  │ AI / IPFS    │
│ Crop/Users   │  │ Verification │
│ Quotes/etc.  │  │ Evidence     │
└──────────────┘  └──────────────┘
        │
        │ Blockchain interaction
        ▼
┌─────────────────────────────┐
│ Ethereum Sepolia            │
│ Smart Escrow Contracts      │
└──────────────┬──────────────┘
               │
               ▼
          MetaMask
```

---

# 📂 Project Structure

The project is organized into frontend and backend applications.

A typical structure is:

```text
farmerChain/
│
├── backend/
│   ├── manage.py
│   ├── farmer/
│   ├── escrow/
│   ├── ...
│   └── requirements.txt
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── farmer/
│   │   │   ├── fpo/
│   │   │   └── ...
│   │   ├── ...
│   │   └── ...
│   ├── package.json
│   └── ...
│
├── contracts/
│   ├── FarmerChainEscrow.sol
│   └── ...
│
└── README.md
```

The exact structure may vary as development continues.

---

# ⚙️ Local Development Setup

## Prerequisites

Install:

- Python 3.x
- Node.js
- npm
- MetaMask
- Git

For blockchain testing:

- MetaMask wallet
- Sepolia network enabled
- Sepolia test ETH

---

## Backend

Navigate to the backend:

```bash
cd backend
```

Create/activate the Python virtual environment if required.

Install dependencies:

```bash
pip install -r requirements.txt
```

Run Django migrations:

```bash
python manage.py migrate
```

Create an admin user:

```bash
python manage.py createsuperuser
```

Start the backend:

```bash
python manage.py runserver
```

The Django development server normally runs at:

```text
http://127.0.0.1:8000/
```

---

## Frontend

Open another terminal:

```bash
cd frontend
```

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Vite normally provides a local URL such as:

```text
http://localhost:5173/
```

---

# 🦊 MetaMask / Sepolia Setup

For the blockchain demo:

1. Install MetaMask.
2. Enable the Sepolia test network.
3. Connect the wallet to FarmerChain.
4. Obtain Sepolia test ETH from a suitable Sepolia faucet.
5. Use separate test accounts for Farmer and FPO where required.
6. Confirm that transactions are being sent to the intended Sepolia contract.

The demo uses testnet assets only.

---

# 🔐 Security & Trust Model

FarmerChain uses several layers of trust:

### Application Layer

Django manages:

- User accounts
- Roles
- Crop information
- Quotes
- Bids
- Transaction records
- Inventory records

### Verification Layer

Crop images and supporting evidence provide additional information for crop verification.

### Blockchain Layer

Ethereum Sepolia provides independently verifiable transaction records for escrow operations.

### Wallet Layer

MetaMask provides user-controlled signing for blockchain transactions.

The goal is to avoid relying on a single database record as the only source of truth for critical payment operations.

---

# 👥 User Roles

## Farmer

Can:

- Register
- Connect wallet
- Create crop passports
- Upload crop images
- Complete crop verification
- List crops
- Set asking prices
- Receive FPO bids
- Negotiate
- Participate in escrow transactions
- Confirm delivery where applicable

## FPO

Can:

- Review farmer crop listings
- Review crop/passport information
- Bid on crops
- Negotiate prices
- Create/fund blockchain escrow
- Manage acquired inventory
- Build retailer-facing market quotes as the platform expands

## Retailer

The retailer workflow is under active development.

The planned capabilities include:

- Browse FPO products
- View provenance
- Add products to cart
- Negotiate prices
- Place orders
- Complete escrow payment
- Confirm delivery

## Admin

The admin layer manages platform-level approval and administration through Django Admin.

---

# 🎥 Hackathon Demo Flow

The recommended demo focuses on the Farmer → FPO journey.

### Step 1 — Farmer Registration

Create the farmer account and connect MetaMask.

### Step 2 — Admin Approval

Approve the farmer through the administration workflow.

### Step 3 — Farmer Login

Log into the farmer dashboard.

### Step 4 — Create Crop Passport

Enter crop information and upload the crop image.

### Step 5 — Verification

Complete the crop verification/passport workflow.

### Step 6 — Offer Crop to FPO

Create the farmer's crop listing with quantity and asking price.

### Step 7 — FPO Review

Switch to the FPO account and review the crop, quantity, price, and provenance.

### Step 8 — FPO Bid

The FPO submits a bid.

### Step 9 — Negotiation

The farmer and FPO can negotiate until a price is agreed.

### Step 10 — Blockchain Escrow

The farmer creates the smart-contract escrow using MetaMask on Sepolia.

### Step 11 — FPO Funding

The FPO deposits the agreed ETH amount into the escrow.

### Step 12 — Delivery

After delivery confirmation, the escrow lifecycle proceeds toward payment release.

---

# 🧪 Testing & Development

The project has been developed iteratively with backend, frontend, and blockchain integration testing.

Development checks include:

- Django system checks
- API validation
- Frontend builds
- Farmer/FPO workflow testing
- MetaMask transaction testing
- Sepolia transaction verification
- Escrow lifecycle testing

Testing is performed against the current implementation as features evolve.

---

# 📈 Roadmap

## Completed / Demonstrated

- [x] Farmer registration
- [x] MetaMask wallet connection
- [x] Admin approval workflow
- [x] Crop registration
- [x] Digital crop passport
- [x] Crop image upload
- [x] AI-assisted verification workflow
- [x] Crop listing
- [x] Farmer → FPO interaction
- [x] FPO bidding
- [x] Price negotiation workflow
- [x] Ethereum Sepolia integration
- [x] Smart escrow creation
- [x] FPO escrow funding
- [x] Delivery/payment lifecycle foundation

## In Development / Next

- [ ] FPO provenance-preserving inventory
- [ ] FPO stock cart
- [ ] Partial stock allocation
- [ ] FPO → Retailer market quotes
- [ ] Retailer cart
- [ ] Multi-farmer provenance in retailer orders
- [ ] Farmer ↔ FPO chat
- [ ] FPO ↔ Retailer chat
- [ ] Multi-round negotiation
- [ ] FPO → Retailer escrow/payment
- [ ] End-to-end retailer delivery flow
- [ ] Expanded filtering and marketplace discovery

---

# 🌍 Vision

FarmerChain aims to create a transparent agricultural marketplace where the history of a product does not disappear as it moves through the supply chain.

Instead of:

```text
Farmer → FPO → Retailer
```

being a series of disconnected transactions, FarmerChain aims to create:

```text
Farmer
  ↓
Verified Crop
  ↓
Crop Passport
  ↓
FPO Inventory
  ↓
Retailer Order
  ↓
Blockchain Payment
  ↓
Delivery
```

with provenance preserved at every stage.

Our long-term goal is a **trusted, traceable and digitally verifiable agricultural supply chain** where farmers receive transparent market access, FPOs can manage verified inventory, and retailers can understand the origin of the products they purchase.

---

# 🏆 Hackathon Value Proposition

FarmerChain combines:

**🌾 Agriculture + 🤖 AI + 🔗 Blockchain + 📦 Traceability + 💰 Digital Escrow**

to address a real supply-chain problem.

The key innovation is not simply putting a payment on blockchain. It is connecting **crop identity, provenance, commercial negotiation, inventory, and blockchain settlement** into one continuous transaction history.

---

# 📜 License

Add the project's intended open-source or proprietary license here before public release.

---

# 👨‍💻 Project Status

FarmerChain is an actively developed hackathon project.

The **Farmer → FPO blockchain transaction flow** is the primary demonstrated workflow, while the **FPO → Retailer provenance-aware marketplace** is being developed as the next stage.
