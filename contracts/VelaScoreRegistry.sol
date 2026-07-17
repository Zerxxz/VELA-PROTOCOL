// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {IVelaScoreRegistry} from "./interfaces/IVelaScoreRegistry.sol";
import {IVelaTeeRegistry} from "./interfaces/IVelaTeeRegistry.sol";
import {VelaAttestationLib} from "./lib/VelaAttestationLib.sol";

/// @title VelaScoreRegistry
/// @notice On-chain home for confidential credit scores. A score can only be
///         written by presenting a signature from an *active* Confidential
///         Compute enclave (see VelaTeeRegistry). The enclave computes the score
///         over private, FDC-attested data and signs the result; this contract
///         verifies the signature and stores only the non-sensitive outcome.
contract VelaScoreRegistry is IVelaScoreRegistry {
    using VelaAttestationLib for VelaAttestationLib.ScoreAttestation;

    string public constant NAME = "VELA";
    string public constant VERSION = "1";

    IVelaTeeRegistry public immutable teeRegistry;
    bytes32 public immutable domainSeparator;

    uint16 public constant MAX_SCORE = 1000;
    uint8 public constant MAX_TIER = 4;

    mapping(address => Score) private _scores;
    mapping(address => uint256) public nonces; // replay protection per subject

    error InactiveTee(address tee);
    error StaleAttestation();
    error BadNonce(uint256 expected, uint256 got);
    error ScoreOutOfRange();
    error TierOutOfRange();
    error NotSubjectOrTee();

    constructor(IVelaTeeRegistry teeRegistry_) {
        teeRegistry = teeRegistry_;
        domainSeparator = VelaAttestationLib.domainSeparator(NAME, VERSION, address(this));
    }

    /// @notice Submit a freshly computed score attestation signed by an enclave.
    /// @dev Anyone may relay the transaction (the subject, a keeper, or the
    ///      enclave gateway) because authenticity is enforced by the signature,
    ///      not by msg.sender.
    function submitScore(
        VelaAttestationLib.ScoreAttestation calldata attestation,
        bytes calldata signature
    ) external {
        if (attestation.score > MAX_SCORE) revert ScoreOutOfRange();
        if (attestation.riskTier > MAX_TIER) revert TierOutOfRange();
        if (attestation.validUntil <= block.timestamp) revert StaleAttestation();

        uint256 expected = nonces[attestation.subject];
        if (attestation.nonce != expected) revert BadNonce(expected, attestation.nonce);

        bytes32 d = VelaAttestationLib.digest(domainSeparator, _mem(attestation));
        address signer = VelaAttestationLib.recover(d, signature);
        if (!teeRegistry.isActiveTee(signer)) revert InactiveTee(signer);

        nonces[attestation.subject] = expected + 1;
        _scores[attestation.subject] = Score({
            score: attestation.score,
            riskTier: attestation.riskTier,
            dataCommitment: attestation.dataCommitment,
            issuedAt: attestation.issuedAt,
            validUntil: attestation.validUntil,
            tee: signer
        });

        emit ScoreUpdated(
            attestation.subject,
            attestation.score,
            attestation.riskTier,
            attestation.dataCommitment,
            attestation.validUntil,
            signer
        );
    }

    function scoreOf(address subject) external view returns (Score memory) {
        return _scores[subject];
    }

    function hasFreshScore(address subject) public view returns (bool) {
        Score memory s = _scores[subject];
        return s.validUntil > block.timestamp && s.tee != address(0);
    }

    /// @dev calldata -> memory helper so the library can hash the struct.
    function _mem(VelaAttestationLib.ScoreAttestation calldata a)
        private
        pure
        returns (VelaAttestationLib.ScoreAttestation memory m)
    {
        m = VelaAttestationLib.ScoreAttestation({
            subject: a.subject,
            score: a.score,
            riskTier: a.riskTier,
            dataCommitment: a.dataCommitment,
            issuedAt: a.issuedAt,
            validUntil: a.validUntil,
            nonce: a.nonce
        });
    }
}
