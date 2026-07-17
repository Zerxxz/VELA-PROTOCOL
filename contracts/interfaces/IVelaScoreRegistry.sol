// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

/// @title IVelaScoreRegistry
/// @notice Stores confidential credit scores produced inside a Flare
///         Confidential Compute enclave. Only the *result* of the private
///         computation is ever placed on-chain -- never the raw financial data.
interface IVelaScoreRegistry {
    /// @param score        VELA score in the range [0, 1000].
    /// @param riskTier     Derived tier 0..4 (0 = highest risk, 4 = prime).
    /// @param dataCommitment keccak256 commitment to the FDC-attested inputs the
    ///                       enclave consumed. Lets anyone audit *which* inputs
    ///                       were used without revealing their contents.
    /// @param issuedAt     Enclave timestamp when the score was signed.
    /// @param validUntil   Expiry after which the score must be refreshed.
    /// @param tee          The TEE identity that signed this attestation.
    struct Score {
        uint16 score;
        uint8 riskTier;
        bytes32 dataCommitment;
        uint64 issuedAt;
        uint64 validUntil;
        address tee;
    }

    event ScoreUpdated(
        address indexed subject,
        uint16 score,
        uint8 riskTier,
        bytes32 dataCommitment,
        uint64 validUntil,
        address indexed tee
    );

    /// @notice Returns the latest stored score for `subject`.
    function scoreOf(address subject) external view returns (Score memory);

    /// @notice Returns true when a fresh (non-expired) score exists for `subject`.
    function hasFreshScore(address subject) external view returns (bool);
}
