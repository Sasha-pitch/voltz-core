pragma solidity ^0.8.0;

pragma abicoder v2;

import "../interfaces/IMarginEngine.sol";
import "../interfaces/IVAMM.sol";
import "../interfaces/IPeriphery.sol";
import "../utils/TickMath.sol";
import "./peripheral_libraries/LiquidityAmounts.sol";
import "hardhat/console.sol";


contract Periphery is IPeriphery {

    function getMarginEngine(address marginEngineAddress)
        public
        pure
        override
        returns (IMarginEngine)
    {
        IMarginEngine marginEngine = IMarginEngine(marginEngineAddress);
        return marginEngine;
    }

    function getVAMM(address marginEngineAddress)
        public
        view
        override
        returns (IVAMM)
    {
        IMarginEngine marginEngine = getMarginEngine(marginEngineAddress);

        IVAMM vamm = marginEngine.vamm();

        return vamm;
    }

    /// @notice Add liquidity to an initialized pool
    function mintOrBurn(MintOrBurnParams memory params)
        external
        override
        returns (int256 positionMarginRequirement)
    {
        require(
            msg.sender == params.recipient,
            "msg.sender must be the recipient"
        );

        IVAMM vamm = getVAMM(params.marginEngineAddress);

        // compute the liquidity amount for the amount of notional (amount1) specified

        uint160 sqrtRatioAX96 = TickMath.getSqrtRatioAtTick(params.tickLower);
        uint160 sqrtRatioBX96 = TickMath.getSqrtRatioAtTick(params.tickUpper);

        uint128 liquidity = LiquidityAmounts.getLiquidityForAmount1(
            sqrtRatioAX96,
            sqrtRatioBX96,
            params.notional
        );

        console.log("liquidity TO BE MINTED", liquidity);
        positionMarginRequirement = 0;
        if (params.isMint) {
            positionMarginRequirement = vamm.mint(
                params.recipient,
                params.tickLower,
                params.tickUpper,
                liquidity
            );
        } else {
            // invoke a burn
            positionMarginRequirement = vamm.burn(
                params.recipient,
                params.tickLower,
                params.tickUpper,
                liquidity
            );
        }
    }

    function swap(SwapPeripheryParams memory params)
        external
        override
        returns (
            int256 _fixedTokenDelta,
            int256 _variableTokenDelta,
            uint256 _cumulativeFeeIncurred,
            int256 _fixedTokenDeltaUnbalanced,
            int256 _marginRequirement
        )
    {
        require(
            msg.sender == params.recipient,
            "msg.sender must be the recipient"
        );

        IVAMM vamm = getVAMM(params.marginEngineAddress);

        int256 amountSpecified;

        if (params.isFT) {
            amountSpecified = int256(params.notional);
        } else {
            amountSpecified = -int256(params.notional);
        }

        int24 tickSpacing = vamm.tickSpacing();

        IVAMM.SwapParams memory swapParams = IVAMM.SwapParams({
            recipient: msg.sender,
            amountSpecified: amountSpecified,
            sqrtPriceLimitX96: params.sqrtPriceLimitX96 == 0
                ? (
                    !params.isFT
                        ? TickMath.MIN_SQRT_RATIO + 1
                        : TickMath.MAX_SQRT_RATIO - 1
                )
                : params.sqrtPriceLimitX96,
            tickLower: params.tickLower == 0 ? -tickSpacing : params.tickLower,
            tickUpper: params.tickUpper == 0 ? tickSpacing : params.tickUpper
        });

        return vamm.swap(swapParams);
    }

}
