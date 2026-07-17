// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

/// @notice Reference example (mirrors the Flare dev-hub sample) showing how VELA
///         reads a live FTSOv2 feed on Coston2/Flare via the ContractRegistry.
///         Kept as documentation of the real integration path; the LendingPool
///         uses an injected IFtsoV2 so it stays unit-testable.
///
/// On a real network you would import:
///   import {ContractRegistry} from "@flarenetwork/flare-periphery-contracts/coston2/ContractRegistry.sol";
///   import {TestFtsoV2Interface} from "@flarenetwork/flare-periphery-contracts/coston2/TestFtsoV2Interface.sol";
///
/// and resolve the oracle with:
///   TestFtsoV2Interface ftsoV2 = ContractRegistry.getTestFtsoV2();
///   (uint256 value, int8 decimals, uint64 ts) = ftsoV2.getFeedById(FXRP_USD);
///
/// The FXRP/USD feed id (bytes21) is published in the Flare feed registry.
contract FtsoV2FeedConsumerDoc {
    // FLR/USD  = 0x01464c522f55534400000000000000000000000000
    // BTC/USD  = 0x014254432f55534400000000000000000000000000
    // XRP/USD  = 0x015852502f55534400000000000000000000000000
    bytes21 public constant XRP_USD = 0x015852502f55534400000000000000000000000000;
}
