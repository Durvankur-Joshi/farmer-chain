// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// ─────────────────────────────────────────────────────────────────────────────
// FarmerChain Crop Passport NFT — Phase 2.2
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
//   6. Put it in frontend/.env as VITE_CROP_PASSPORT_CONTRACT=0x...
//
// Authorization model:
//   - Any wallet may call mintCropPassport() for itself.
//   - The minted NFT always belongs to msg.sender (the farmer's MetaMask wallet).
//   - No centralized minting key; no admin custody of farmer funds.
//   - The frontend verifies that msg.sender matches the farmer's registered
//     wallet before initiating the transaction.
// ─────────────────────────────────────────────────────────────────────────────

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";

contract FarmerChainCropPassport is ERC721URIStorage {
    // ── State ──────────────────────────────────────────────────────
    uint256 private _tokenIdCounter;

    // ── Events ─────────────────────────────────────────────────────
    event CropPassportMinted(
        uint256 indexed tokenId,
        address indexed farmer,
        string  tokenURI
    );

    // ── Constructor ────────────────────────────────────────────────
    constructor() ERC721("FarmerChain Crop Passport", "FCCP") {
        _tokenIdCounter = 0;
    }

    // ── Minting ────────────────────────────────────────────────────
    /**
     * @notice Mint a Crop Passport NFT.
     * @dev    Anyone may call this for their own wallet.
     *         The NFT is minted TO msg.sender (the farmer's MetaMask wallet).
     *         tokenURI should be an IPFS URI pointing to crop metadata JSON.
     * @param  tokenURI  IPFS metadata URI (e.g. ipfs://Qm...)
     * @return newTokenId The newly assigned token ID.
     */
    function mintCropPassport(string memory tokenURI)
        public
        returns (uint256)
    {
        _tokenIdCounter += 1;
        uint256 newTokenId = _tokenIdCounter;

        _safeMint(msg.sender, newTokenId);
        _setTokenURI(newTokenId, tokenURI);

        emit CropPassportMinted(newTokenId, msg.sender, tokenURI);
        return newTokenId;
    }

    // ── View helpers ───────────────────────────────────────────────
    /**
     * @notice Returns the total number of Crop Passports minted so far.
     */
    function totalSupply() public view returns (uint256) {
        return _tokenIdCounter;
    }
}
