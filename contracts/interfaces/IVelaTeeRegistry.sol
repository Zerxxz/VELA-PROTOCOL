// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

/// @title IVelaTeeRegistry
/// @notice Registry of Trusted Execution Environment (TEE) identities allowed to
///         sign VELA confidential score attestations.
/// @dev A TEE identity is the EVM address derived from the secp256k1 public key
///      that a Flare Confidential Compute enclave generates at boot. In
///      production the enclave proves it runs an approved code measurement via a
///      GCP vTPM quote (see flare-foundation/flare-vtpm-attestation) relayed
///      on-chain through the FDC. This registry stores the resulting trusted
///      identities together with the code measurement they attested to.
interface IVelaTeeRegistry {
    struct TeeIdentity {
        bytes32 codeMeasurement; // image/code hash the enclave attested to
        uint64 registeredAt;     // block timestamp of registration
        uint64 expiresAt;        // identity rotation deadline (0 = no expiry)
        bool revoked;            // manually revoked by governance
    }

    event TeeRegistered(address indexed tee, bytes32 indexed codeMeasurement, uint64 expiresAt);
    event TeeRevoked(address indexed tee);

    /// @notice Returns true when `tee` is registered, not revoked and not expired.
    function isActiveTee(address tee) external view returns (bool);

    /// @notice Returns the stored identity record for `tee`.
    function identityOf(address tee) external view returns (TeeIdentity memory);

    /// @notice The set of code measurements currently accepted by governance.
    function isApprovedMeasurement(bytes32 codeMeasurement) external view returns (bool);
}
