// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// ─────────────────────────────────────────────────────────────────────────────
// FarmerChain Escrow — Phase 2.5
// Network: Ethereum Sepolia (chain ID 11155111)
//
// Deploy via Remix IDE:
//   1. Open https://remix.ethereum.org
//   2. Create a new file and paste this contract
//   3. Compile with Solidity 0.8.20+
//   4. In "Deploy & Run" tab:
//      - Environment: "Injected Provider - MetaMask"
//      - Switch MetaMask to Sepolia
//      - Click Deploy
//   5. Copy the deployed contract address
//   6. Put it in frontend/.env as ESCROW_CONTRACT_ADDRESS=0x...
//      and in backend/.env as ESCROW_CONTRACT_ADDRESS=0x...
//
// Authorization:
//   - Farmer creates escrow (on-chain record)
//   - FPO deposits ETH into escrow
//   - Farmer confirms delivery
//   - FPO releases payment to farmer
//   - Either party can cancel BEFORE funding
//   - No admin custody of funds; all via MetaMask
// ─────────────────────────────────────────────────────────────────────────────

contract FarmerChainEscrow {

    // ── Escrow States ─────────────────────────────────────────────
    enum EscrowStatus {
        Created,            // 0 — escrow record exists, not yet funded
        Funded,             // 1 — FPO deposited ETH
        DeliveryConfirmed,  // 2 — Farmer confirmed delivery
        Released,           // 3 — Payment released to farmer
        Cancelled,          // 4 — Cancelled before funding
        Disputed            // 5 — Dispute raised (future use)
    }

    // ── Escrow Data ───────────────────────────────────────────────
    struct Escrow {
        uint256 id;
        address payable farmer;
        address payable fpo;
        uint256 amount;         // in wei
        uint256 quoteRef;       // off-chain quote ID
        EscrowStatus status;
        uint256 createdAt;
        uint256 depositedAt;
        uint256 deliveryConfirmedAt;
        uint256 releasedAt;
    }

    // ── State Variables ───────────────────────────────────────────
    uint256 private _escrowCounter;
    mapping(uint256 => Escrow) private _escrows;

    // ── Events ────────────────────────────────────────────────────
    event EscrowCreated(
        uint256 indexed escrowId,
        address indexed farmer,
        address indexed fpo,
        uint256 amount,
        uint256 quoteRef
    );

    event EscrowFunded(
        uint256 indexed escrowId,
        address indexed fpo,
        uint256 amount
    );

    event DeliveryConfirmed(
        uint256 indexed escrowId,
        address indexed farmer
    );

    event PaymentReleased(
        uint256 indexed escrowId,
        address indexed farmer,
        uint256 amount
    );

    event EscrowCancelled(
        uint256 indexed escrowId,
        address indexed cancelledBy
    );

    event EscrowDisputed(
        uint256 indexed escrowId,
        address indexed disputedBy
    );

    // ── Modifiers ─────────────────────────────────────────────────

    modifier escrowExists(uint256 escrowId) {
        require(_escrows[escrowId].id != 0, "Escrow does not exist");
        _;
    }

    modifier onlyFarmer(uint256 escrowId) {
        require(
            msg.sender == _escrows[escrowId].farmer,
            "Only the farmer can perform this action"
        );
        _;
    }

    modifier onlyFPO(uint256 escrowId) {
        require(
            msg.sender == _escrows[escrowId].fpo,
            "Only the FPO can perform this action"
        );
        _;
    }

    modifier onlyParties(uint256 escrowId) {
        require(
            msg.sender == _escrows[escrowId].farmer ||
            msg.sender == _escrows[escrowId].fpo,
            "Only farmer or FPO can perform this action"
        );
        _;
    }

    // ── Core Functions ────────────────────────────────────────────

    /**
     * @notice Create a new escrow agreement.
     * @dev    Called by the farmer. The FPO address and amount are set here.
     *         No ETH is transferred at this point.
     * @param  _fpo       Address of the FPO
     * @param  _amount    Escrow amount in wei
     * @param  _quoteRef  Off-chain quote ID for reference
     * @return escrowId   The newly created escrow ID
     */
    function createEscrow(
        address payable _fpo,
        uint256 _amount,
        uint256 _quoteRef
    ) external returns (uint256) {
        require(_fpo != address(0), "FPO address cannot be zero");
        require(_fpo != msg.sender, "Farmer and FPO cannot be the same");
        require(_amount > 0, "Amount must be greater than zero");

        _escrowCounter += 1;
        uint256 newId = _escrowCounter;

        _escrows[newId] = Escrow({
            id: newId,
            farmer: payable(msg.sender),
            fpo: _fpo,
            amount: _amount,
            quoteRef: _quoteRef,
            status: EscrowStatus.Created,
            createdAt: block.timestamp,
            depositedAt: 0,
            deliveryConfirmedAt: 0,
            releasedAt: 0
        });

        emit EscrowCreated(newId, msg.sender, _fpo, _amount, _quoteRef);
        return newId;
    }

    /**
     * @notice FPO deposits ETH into the escrow.
     * @dev    msg.value must exactly match the escrow amount.
     *         Can only be called when status is Created.
     * @param  escrowId  The escrow to fund
     */
    function depositEscrow(uint256 escrowId)
        external
        payable
        escrowExists(escrowId)
        onlyFPO(escrowId)
    {
        Escrow storage e = _escrows[escrowId];
        require(e.status == EscrowStatus.Created, "Escrow is not in Created state");
        require(msg.value == e.amount, "Deposit must exactly match escrow amount");

        e.status = EscrowStatus.Funded;
        e.depositedAt = block.timestamp;

        emit EscrowFunded(escrowId, msg.sender, msg.value);
    }

    /**
     * @notice Farmer confirms delivery of the crop.
     * @dev    Can only be called when status is Funded.
     * @param  escrowId  The escrow to confirm delivery for
     */
    function confirmDelivery(uint256 escrowId)
        external
        escrowExists(escrowId)
        onlyFarmer(escrowId)
    {
        Escrow storage e = _escrows[escrowId];
        require(e.status == EscrowStatus.Funded, "Escrow is not in Funded state");

        e.status = EscrowStatus.DeliveryConfirmed;
        e.deliveryConfirmedAt = block.timestamp;

        emit DeliveryConfirmed(escrowId, msg.sender);
    }

    /**
     * @notice Release escrowed payment to the farmer.
     * @dev    Can only be called by the FPO after delivery is confirmed.
     *         Uses checks-effects-interactions pattern to prevent reentrancy.
     * @param  escrowId  The escrow to release payment for
     */
    function releasePayment(uint256 escrowId)
        external
        escrowExists(escrowId)
        onlyFPO(escrowId)
    {
        Escrow storage e = _escrows[escrowId];
        require(
            e.status == EscrowStatus.DeliveryConfirmed,
            "Delivery must be confirmed before release"
        );

        uint256 amount = e.amount;

        // Effects first (checks-effects-interactions)
        e.status = EscrowStatus.Released;
        e.releasedAt = block.timestamp;

        // Interaction last
        (bool sent, ) = e.farmer.call{value: amount}("");
        require(sent, "Payment transfer failed");

        emit PaymentReleased(escrowId, e.farmer, amount);
    }

    /**
     * @notice Cancel the escrow. Only allowed before funding.
     * @dev    Either farmer or FPO can cancel a Created escrow.
     * @param  escrowId  The escrow to cancel
     */
    function cancelEscrow(uint256 escrowId)
        external
        escrowExists(escrowId)
        onlyParties(escrowId)
    {
        Escrow storage e = _escrows[escrowId];
        require(
            e.status == EscrowStatus.Created,
            "Can only cancel escrow before funding"
        );

        e.status = EscrowStatus.Cancelled;

        emit EscrowCancelled(escrowId, msg.sender);
    }

    /**
     * @notice Raise a dispute on a funded escrow.
     * @dev    Either party can dispute. Funds remain locked.
     *         Dispute resolution is handled off-chain in this version.
     * @param  escrowId  The escrow to dispute
     */
    function raiseDispute(uint256 escrowId)
        external
        escrowExists(escrowId)
        onlyParties(escrowId)
    {
        Escrow storage e = _escrows[escrowId];
        require(
            e.status == EscrowStatus.Funded ||
            e.status == EscrowStatus.DeliveryConfirmed,
            "Can only dispute funded or delivery-confirmed escrows"
        );

        e.status = EscrowStatus.Disputed;

        emit EscrowDisputed(escrowId, msg.sender);
    }

    // ── View Functions ────────────────────────────────────────────

    /**
     * @notice Get full escrow details.
     */
    function getEscrow(uint256 escrowId)
        external
        view
        escrowExists(escrowId)
        returns (
            uint256 id,
            address farmer,
            address fpo,
            uint256 amount,
            uint256 quoteRef,
            EscrowStatus status,
            uint256 createdAt,
            uint256 depositedAt,
            uint256 deliveryConfirmedAt,
            uint256 releasedAt
        )
    {
        Escrow storage e = _escrows[escrowId];
        return (
            e.id, e.farmer, e.fpo, e.amount, e.quoteRef,
            e.status, e.createdAt, e.depositedAt,
            e.deliveryConfirmedAt, e.releasedAt
        );
    }

    /**
     * @notice Get escrow status only.
     */
    function getEscrowStatus(uint256 escrowId)
        external
        view
        escrowExists(escrowId)
        returns (EscrowStatus)
    {
        return _escrows[escrowId].status;
    }

    /**
     * @notice Get total number of escrows created.
     */
    function totalEscrows() external view returns (uint256) {
        return _escrowCounter;
    }
}
