// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {IFtsoV2} from "../VelaLendingPool.sol";

/// @notice Deterministic FTSOv2 stand-in for local tests and demos.
contract MockFtsoV2 is IFtsoV2 {
    uint256 public value;
    int8 public decimals;

    constructor(uint256 value_, int8 decimals_) {
        value = value_;
        decimals = decimals_;
    }

    function setPrice(uint256 value_, int8 decimals_) external {
        value = value_;
        decimals = decimals_;
    }

    function getFeedById(bytes21)
        external
        payable
        override
        returns (uint256, int8, uint64)
    {
        return (value, decimals, uint64(block.timestamp));
    }
}
