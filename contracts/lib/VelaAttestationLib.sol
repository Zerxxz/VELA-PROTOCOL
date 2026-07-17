// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

/// @title VelaAttestationLib
/// @notice Canonical EIP-712 style hashing for VELA score attestations plus a
///         minimal, safe ECDSA recovery. Keeping the digest construction in one
///         library guarantees the enclave (off-chain signer) and the registry
///         (on-chain verifier) agree byte-for-byte on what is being signed.
library VelaAttestationLib {
    /// @dev keccak256("VelaScoreAttestation(address subject,uint16 score,uint8 riskTier,bytes32 dataCommitment,uint64 issuedAt,uint64 validUntil,uint256 nonce)")
    bytes32 internal constant SCORE_TYPEHASH =
        keccak256(
            "VelaScoreAttestation(address subject,uint16 score,uint8 riskTier,bytes32 dataCommitment,uint64 issuedAt,uint64 validUntil,uint256 nonce)"
        );

    struct ScoreAttestation {
        address subject;
        uint16 score;
        uint8 riskTier;
        bytes32 dataCommitment;
        uint64 issuedAt;
        uint64 validUntil;
        uint256 nonce;
    }

    function domainSeparator(string memory name, string memory version, address verifyingContract)
        internal
        view
        returns (bytes32)
    {
        return keccak256(
            abi.encode(
                keccak256(
                    "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
                ),
                keccak256(bytes(name)),
                keccak256(bytes(version)),
                block.chainid,
                verifyingContract
            )
        );
    }

    function structHash(ScoreAttestation memory a) internal pure returns (bytes32) {
        return keccak256(
            abi.encode(
                SCORE_TYPEHASH,
                a.subject,
                a.score,
                a.riskTier,
                a.dataCommitment,
                a.issuedAt,
                a.validUntil,
                a.nonce
            )
        );
    }

    function digest(bytes32 separator, ScoreAttestation memory a)
        internal
        pure
        returns (bytes32)
    {
        return keccak256(abi.encodePacked("\x19\x01", separator, structHash(a)));
    }

    /// @notice Recovers the signer of `hash` from a 65-byte signature.
    /// @dev Rejects malleable (high-s) signatures per EIP-2.
    function recover(bytes32 hash, bytes memory signature) internal pure returns (address) {
        require(signature.length == 65, "VELA: bad sig length");
        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly {
            r := mload(add(signature, 0x20))
            s := mload(add(signature, 0x40))
            v := byte(0, mload(add(signature, 0x60)))
        }
        require(
            uint256(s) <= 0x7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF5D576E7357A4501DDFE92F46681B20A0,
            "VELA: high-s"
        );
        require(v == 27 || v == 28, "VELA: bad v");
        address signer = ecrecover(hash, v, r, s);
        require(signer != address(0), "VELA: bad sig");
        return signer;
    }
}
