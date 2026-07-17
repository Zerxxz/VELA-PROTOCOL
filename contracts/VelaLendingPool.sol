// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {IVelaScoreRegistry} from "./interfaces/IVelaScoreRegistry.sol";

interface IERC20Minimal {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
    function decimals() external view returns (uint8);
}

/// @notice Minimal FTSOv2 surface used by VELA. On Coston2/Flare the real
///         instance is fetched from ContractRegistry.getFtsoV2(). We depend only
///         on getFeedById so the pool can be unit-tested with a mock.
interface IFtsoV2 {
    function getFeedById(bytes21 _feedId)
        external
        payable
        returns (uint256 value, int8 decimals, uint64 timestamp);
}

/// @title VelaLendingPool
/// @notice Under-collateralized FXRP lending gated by a borrower's confidential
///         VELA score. The higher the score, the lower the collateral the
///         borrower must lock -- turning a *private* creditworthiness proof into
///         real capital efficiency. Prices come from FTSOv2, the loan asset is
///         FXRP (FAssets), and the score comes from a TEE. All three Flare
///         pillars in one product.
contract VelaLendingPool {
    IVelaScoreRegistry public immutable scoreRegistry;
    IFtsoV2 public ftsoV2;
    IERC20Minimal public immutable fxrp; // borrowable / collateral asset (FAssets)

    /// @dev FTSOv2 feed id for FXRP/USD (bytes21). Configurable by governance so
    ///      the same code works across Coston2 and Flare mainnet.
    bytes21 public fxrpUsdFeedId;
    address public governance;

    /// @notice Collateral factor per risk tier in basis points of the loan value.
    ///         tier 0 -> 15000 (150%, over-collateralized) ... tier 4 -> 6000 (60%).
    ///         Lower value = more capital efficient = reward for a better score.
    uint16[5] public collateralFactorBps = [15000, 12000, 10000, 8000, 6000];

    struct Loan {
        uint256 principal;   // FXRP borrowed
        uint256 collateral;  // FXRP locked
        uint64 openedAt;
        bool active;
    }

    mapping(address => Loan) public loans;
    uint256 public totalLiquidity;

    event Borrowed(address indexed borrower, uint256 principal, uint256 collateral, uint8 tier);
    event Repaid(address indexed borrower, uint256 principal, uint256 collateralReturned);
    event LiquidityAdded(address indexed provider, uint256 amount);

    error NoFreshScore();
    error TierTooLow();
    error InsufficientCollateral(uint256 required, uint256 provided);
    error InsufficientLiquidity();
    error NoActiveLoan();
    error NotGovernance();

    modifier onlyGovernance() {
        if (msg.sender != governance) revert NotGovernance();
        _;
    }

    constructor(
        IVelaScoreRegistry scoreRegistry_,
        IFtsoV2 ftsoV2_,
        IERC20Minimal fxrp_,
        bytes21 fxrpUsdFeedId_,
        address governance_
    ) {
        scoreRegistry = scoreRegistry_;
        ftsoV2 = ftsoV2_;
        fxrp = fxrp_;
        fxrpUsdFeedId = fxrpUsdFeedId_;
        governance = governance_;
    }

    // --------------------------------------------------------------- liquidity

    function addLiquidity(uint256 amount) external {
        require(fxrp.transferFrom(msg.sender, address(this), amount), "transfer failed");
        totalLiquidity += amount;
        emit LiquidityAdded(msg.sender, amount);
    }

    // ------------------------------------------------------------------ borrow

    /// @notice Required collateral (in FXRP) to borrow `principal` FXRP given a
    ///         borrower's current risk tier. View helper for the frontend.
    function requiredCollateral(address borrower, uint256 principal)
        public
        view
        returns (uint256)
    {
        IVelaScoreRegistry.Score memory s = scoreRegistry.scoreOf(borrower);
        return (principal * collateralFactorBps[s.riskTier]) / 10000;
    }

    function borrow(uint256 principal, uint256 collateral) external {
        if (!scoreRegistry.hasFreshScore(msg.sender)) revert NoFreshScore();
        IVelaScoreRegistry.Score memory s = scoreRegistry.scoreOf(msg.sender);

        uint256 required = (principal * collateralFactorBps[s.riskTier]) / 10000;
        if (collateral < required) revert InsufficientCollateral(required, collateral);
        if (principal > totalLiquidity) revert InsufficientLiquidity();
        require(!loans[msg.sender].active, "loan exists");

        require(fxrp.transferFrom(msg.sender, address(this), collateral), "collat transfer");
        totalLiquidity -= principal;
        require(fxrp.transfer(msg.sender, principal), "principal transfer");

        loans[msg.sender] = Loan({
            principal: principal,
            collateral: collateral,
            openedAt: uint64(block.timestamp),
            active: true
        });

        emit Borrowed(msg.sender, principal, collateral, s.riskTier);
    }

    function repay() external {
        Loan memory loan = loans[msg.sender];
        if (!loan.active) revert NoActiveLoan();

        delete loans[msg.sender];
        require(fxrp.transferFrom(msg.sender, address(this), loan.principal), "repay transfer");
        totalLiquidity += loan.principal;
        require(fxrp.transfer(msg.sender, loan.collateral), "return collat");

        emit Repaid(msg.sender, loan.principal, loan.collateral);
    }

    // -------------------------------------------------------------- ftso price

    /// @notice Returns the USD value (18 decimals) of `fxrpAmount` FXRP (assumed
    ///         18-decimal token) using the live FTSOv2 feed. Used by the UI to
    ///         show loan value in USD.
    /// @dev FTSOv2 returns `value` with `decimals` implied decimal places, i.e.
    ///      realPrice = value / 10**decimals. We normalize the price to 1e18 and
    ///      then multiply by the FXRP amount (also 1e18) dividing out one 1e18.
    function fxrpValueUsd(uint256 fxrpAmount) external returns (uint256) {
        (uint256 value, int8 decimals,) = ftsoV2.getFeedById(fxrpUsdFeedId);
        require(decimals >= 0 && uint8(decimals) <= 18, "VELA: bad feed decimals");
        uint256 priceScaled = value * (10 ** (18 - uint8(decimals))); // price in 1e18
        return (fxrpAmount * priceScaled) / 1e18;
    }

    // -------------------------------------------------------------- governance

    function setFtsoV2(IFtsoV2 ftsoV2_) external onlyGovernance {
        ftsoV2 = ftsoV2_;
    }

    function setFxrpUsdFeedId(bytes21 feedId) external onlyGovernance {
        fxrpUsdFeedId = feedId;
    }

    function setCollateralFactor(uint8 tier, uint16 bps) external onlyGovernance {
        require(tier <= 4, "tier");
        collateralFactorBps[tier] = bps;
    }
}
