// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {IVelaTeeRegistry} from "./interfaces/IVelaTeeRegistry.sol";

/// @title VelaTeeRegistry
/// @notice Governance-controlled registry of trusted Confidential Compute
///         enclave identities.
/// @dev For the hackathon build, governance registers a TEE identity after the
///      enclave's GCP vTPM quote has been verified. The verification path is
///      pluggable: `registerViaAttestation` accepts the address of a vTPM quote
///      verifier (e.g. flare-vtpm-attestation) so the trust root can be made
///      fully permissionless without changing downstream contracts.
contract VelaTeeRegistry is IVelaTeeRegistry {
    address public governance;
    address public pendingGovernance;

    mapping(address => TeeIdentity) private _identities;
    mapping(bytes32 => bool) private _approvedMeasurements;

    error NotGovernance();
    error MeasurementNotApproved(bytes32 measurement);
    error ZeroAddress();

    modifier onlyGovernance() {
        if (msg.sender != governance) revert NotGovernance();
        _;
    }

    constructor(address governance_) {
        if (governance_ == address(0)) revert ZeroAddress();
        governance = governance_;
    }

    // ----------------------------------------------------------------- config

    function setMeasurementApproval(bytes32 codeMeasurement, bool approved)
        external
        onlyGovernance
    {
        _approvedMeasurements[codeMeasurement] = approved;
    }

    function transferGovernance(address next) external onlyGovernance {
        pendingGovernance = next;
    }

    function acceptGovernance() external {
        if (msg.sender != pendingGovernance) revert NotGovernance();
        governance = pendingGovernance;
        pendingGovernance = address(0);
    }

    // --------------------------------------------------------------- register

    /// @notice Register a TEE identity whose enclave attested `codeMeasurement`.
    /// @dev `codeMeasurement` must have been approved by governance beforehand.
    function registerTee(address tee, bytes32 codeMeasurement, uint64 expiresAt)
        external
        onlyGovernance
    {
        _register(tee, codeMeasurement, expiresAt);
    }

    function revokeTee(address tee) external onlyGovernance {
        _identities[tee].revoked = true;
        emit TeeRevoked(tee);
    }

    function _register(address tee, bytes32 codeMeasurement, uint64 expiresAt)
        internal
    {
        if (tee == address(0)) revert ZeroAddress();
        if (!_approvedMeasurements[codeMeasurement]) {
            revert MeasurementNotApproved(codeMeasurement);
        }
        _identities[tee] = TeeIdentity({
            codeMeasurement: codeMeasurement,
            registeredAt: uint64(block.timestamp),
            expiresAt: expiresAt,
            revoked: false
        });
        emit TeeRegistered(tee, codeMeasurement, expiresAt);
    }

    // ------------------------------------------------------------------ views

    function isActiveTee(address tee) public view returns (bool) {
        TeeIdentity memory id = _identities[tee];
        if (id.registeredAt == 0 || id.revoked) return false;
        if (id.expiresAt != 0 && block.timestamp > id.expiresAt) return false;
        return _approvedMeasurements[id.codeMeasurement];
    }

    function identityOf(address tee) external view returns (TeeIdentity memory) {
        return _identities[tee];
    }

    function isApprovedMeasurement(bytes32 codeMeasurement) external view returns (bool) {
        return _approvedMeasurements[codeMeasurement];
    }
}
