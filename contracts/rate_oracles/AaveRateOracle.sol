// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../interfaces/rate_oracles/IAaveRateOracle.sol";
import "../interfaces/aave/IAaveV2LendingPool.sol";
import "../core_libraries/FixedAndVariableMath.sol";
import "../utils/WayRayMath.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "../rate_oracles/BaseRateOracle.sol";
import "hardhat/console.sol";

contract AaveRateOracle is BaseRateOracle, IAaveRateOracle {
    using SafeMath for uint256;

    /// @dev getReserveNormalizedIncome() returned zero for underlying asset. Oracle only supports active Aave-V2 assets.
    error AavePoolGetReserveNormalizedIncomeReturnedZero();

    /// @inheritdoc IAaveRateOracle
    address public override aaveLendingPool;
    
    uint256 public constant ONE_WEI = 10**18;

    constructor(
        address _aaveLendingPool,
        bytes32 _rateOracleId,
        address underlying,
        address factory
    ) BaseRateOracle(_rateOracleId, underlying, factory) {
        aaveLendingPool = _aaveLendingPool;
    }

    /// @notice Store the Aave Lending Pool's current normalized income per unit of an underlying asset, in Ray
    /// @param index The index of the Rate that was most recently written to the Rates array
    /// @param cardinality The number of populated elements in the oracle array
    /// @param cardinalityNext The new length of the oracle array, independent of population
    function writeRate(
        uint16 index,
        uint16 cardinality,
        uint16 cardinalityNext
    )
        public
        override(BaseRateOracle, IRateOracle)
        returns (uint16 indexUpdated, uint16 cardinalityUpdated)
    {
        Rate memory last = rates[index];

        uint256 blockTimestamp = Time.blockTimestampScaled();

        if (last.timestamp != 0) {
            uint256 timeDeltaSinceLastUpdate = blockTimestamp - last.timestamp;
            require(
                timeDeltaSinceLastUpdate > minSecondsSinceLastUpdate,
                "throttle updates"
            );
        }

        // early return if we've already written a Rate in this block
        if (last.timestamp == blockTimestamp) return (index, cardinality);

        // if the conditions are right, we can bump the cardinality
        if (cardinalityNext > cardinality && index == (cardinality - 1)) {
            cardinalityUpdated = cardinalityNext;
        } else {
            cardinalityUpdated = cardinality;
        }

        indexUpdated = (index + 1) % cardinalityUpdated;

        uint256 result = IAaveV2LendingPool(aaveLendingPool)
            .getReserveNormalizedIncome(underlying);
        if (result == 0) {
            revert AavePoolGetReserveNormalizedIncomeReturnedZero();
        }

        rates[indexUpdated] = Rate(blockTimestamp, result);
    }


    /// @notice Computes the APY based on the un-annualised rateFromTo value and timeInYears (in wei)
    /// @param rateFromTo Un-annualised rate (in wei)
    /// @param timeInYears Time in years for the period for which we want to calculate the apy (in wei)
    /// @return apy APY for a given rateFromTo and timeInYears 
    function computeApyFromRate(uint256 rateFromTo, uint256 timeInYears)
        internal
        pure
        returns (uint256 apy)
    {
        uint256 exponent = PRBMathUD60x18.div(ONE_WEI, timeInYears);
        uint256 apyPlusOne = PRBMathUD60x18.pow(
            (ONE_WEI + rateFromTo),
            exponent
        );
        apy = apyPlusOne - ONE_WEI;
    }

    
    /// @inheritdoc BaseRateOracle
    function getApyFromTo(uint256 from, uint256 to)
        internal
        view
        override(BaseRateOracle)
        returns (uint256 apyFromTo)
    {
        require(from < to, "Misordered dates");

        uint256 rateFromTo = getRateFromTo(from, to);

        uint256 timeInSeconds = to - from; // @audit - this is the wimte in seconds wei

        uint256 timeInYears = FixedAndVariableMath.accrualFact(timeInSeconds);

        apyFromTo = computeApyFromRate(rateFromTo, timeInYears);
    }

    /// @notice Calculates the observed interest returned by the underlying in a given period
    /// @dev Reverts if we have no data point for either timestamp
    /// @param from The timestamp of the start of the period, in wei-seconds
    /// @param to The timestamp of the end of the period, in wei-seconds
    /// @return The "floating rate" expressed in Ray, e.g. 4% is encoded as 0.04*10**27 = 4*10*25
    function getRateFromTo(uint256 from, uint256 to)
        public
        view
        returns (uint256)
    {
        // note that we have to convert aave index into "floating rate" for
        // swap calculations, e.g. an index multiple of 1.04*10**27 corresponds to
        // 0.04*10**27 = 4*10*25

        uint256 currentTime = Time.blockTimestampScaled();

        uint256 rateFrom = observeSingle(
            currentTime,
            from,
            oracleVars.rateIndex,
            oracleVars.rateCardinality
        );
        uint256 rateTo = observeSingle(
            currentTime,
            to,
            oracleVars.rateIndex,
            oracleVars.rateCardinality
        );

        if (rateTo > rateFrom) {
            return
                WadRayMath.rayToWad(
                    WadRayMath.rayDiv(rateTo, rateFrom).sub(WadRayMath.RAY)
                );
        } else {
            return 0;
        }
    }

    /// @inheritdoc IRateOracle
    function variableFactor(
        uint256 termStartTimestamp,
        uint256 termEndTimestamp
    )
        public
        view
        override(BaseRateOracle, IRateOracle)
        returns (uint256 result)
    {
        if (Time.blockTimestampScaled() >= termEndTimestamp) {
            result = getRateFromTo(termStartTimestamp, termEndTimestamp);
        } else {
            result = getRateFromTo(
                termStartTimestamp,
                Time.blockTimestampScaled()
            );
        }
    }


    /// @notice Fetches the rates beforeOrAt and atOrAfter a target, i.e. where [beforeOrAt, atOrAfter] is satisfied.
    /// The result may be the same rate, or adjacent rates.
    /// @dev The answer must be contained in the array, used when the target is located within the stored observation
    /// boundaries: older than the most recent observation and younger, or the same age as, the oldest observation
    /// @param target The timestamp (in wei seconds) at which the reserved rate should be for
    /// @param index The index of the rate that was most recently written to the rates array
    /// @param cardinality The number of populated elements in the rates array
    /// @return beforeOrAt The rate recorded before, or at, the target
    /// @return atOrAfter The rate recorded at, or after, the target
    function binarySearch(
        uint256 target,
        uint16 index,
        uint16 cardinality
    ) internal view returns (Rate memory beforeOrAt, Rate memory atOrAfter) {
        uint256 lhs = (index + 1) % cardinality; // oldest observation
        uint256 rhs = lhs + cardinality - 1; // newest observation
        uint256 i;

        while (true) {
            i = (lhs + rhs) / 2;
            beforeOrAt = rates[i % cardinality];

            // we've landed on an uninitialized tick, keep searching higher (more recently)
            if (beforeOrAt.timestamp == 0) {
                lhs = i + 1;
                continue;
            }

            atOrAfter = rates[(i + 1) % cardinality];

            bool targetAtOrAfter = beforeOrAt.timestamp <= target;

            // check if we've found the answer!
            if (targetAtOrAfter && target <= atOrAfter.timestamp) break;

            if (!targetAtOrAfter) rhs = i - 1;
            else lhs = i + 1;
        }
    }

    /// @notice Fetches the rates beforeOrAt and atOrAfter a given target, i.e. where [beforeOrAt, atOrAfter] is satisfied
    /// @dev Assumes there is at least 1 initialized observation.
    /// Used by observeSingle() to compute the counterfactual liquidity index values as of a given block timestamp.
    /// @param target The timestamp at which the reserved observation should be for
    /// @param index The index of the observation that was most recently written to the observations array
    /// @param cardinality The number of populated elements in the oracle array
    /// @return beforeOrAt The rate which occurred at, or before, the given timestamp
    /// @return atOrAfter The rate which occurred at, or after, the given timestamp
    function getSurroundingRates(
        uint256 target,
        uint16 index,
        uint16 cardinality
    ) internal view returns (Rate memory beforeOrAt, Rate memory atOrAfter) {
        // optimistically set before to the newest rate
        beforeOrAt = rates[index];

        if (beforeOrAt.timestamp <= target) {
            if (beforeOrAt.timestamp == target) {
                // if the newest observation eqauls target, we are in the same block, so we can ignore atOrAfter
                return (beforeOrAt, atOrAfter);
            } else {
                atOrAfter = Rate({
                    timestamp: Time.blockTimestampScaled(),
                    rateValue: IAaveV2LendingPool(aaveLendingPool)
                        .getReserveNormalizedIncome(underlying)
                });
                return (beforeOrAt, atOrAfter);
            }
        }

        // set to the oldest observation
        beforeOrAt = rates[(index + 1) % cardinality];

        if (beforeOrAt.timestamp == 0) {
            beforeOrAt = rates[0];
        }

        require(beforeOrAt.timestamp <= target, "OLD");

        // if we've reached this point, we have to binary search
        return binarySearch(target, index, cardinality);
    }

    
    /// @notice Calculates the interpolated (counterfactual) rate value
    /// @param beforeOrAtRateValue  Rate Value (in ray) before the timestamp for which we want to calculate the counterfactual rate value
    /// @param apyFromBeforeOrAtToAtOrAfter Apy in the period between the timestamp of the beforeOrAt Rate and the atOrAfter Rate
    /// @param timeDeltaBeforeOrAtToQueriedTime Time Delta (in wei seconds) between the timestamp of the beforeOrAt Rate and the atOrAfter Rate
    /// @return rateValue Counterfactual (interpolated) rate value in ray
    /// @dev Given [beforeOrAt, atOrAfter] where the timestamp for which the counterfactual is calculated is within that range (but does not touch any of the bounds)
    /// @dev We can calculate the apy for [beforeOrAt, atOrAfter] --> refer to this value as apyFromBeforeOrAtToAtOrAfter
    /// @dev Then we want a counterfactual rate value which results in apy_before_after if the apy is calculated between [beforeOrAt, timestampForCounterfactual]
    /// @dev Hence (1+rateValueWei/beforeOrAtRateValueWei)^(1/timeInYears) = apyFromBeforeOrAtToAtOrAfter
    /// @dev Hence rateValueWei = beforeOrAtRateValueWei * (1+apyFromBeforeOrAtToAtOrAfter)^timeInYears - 1)
    function interpolateRateValue(
        uint256 beforeOrAtRateValue,
        uint256 apyFromBeforeOrAtToAtOrAfter,
        uint256 timeDeltaBeforeOrAtToQueriedTime
    ) internal pure returns (uint256 rateValue) {
        uint256 timeInYears = FixedAndVariableMath.accrualFact(
            timeDeltaBeforeOrAtToQueriedTime
        );
        uint256 exp1 = PRBMathUD60x18.pow(
            (ONE_WEI + apyFromBeforeOrAtToAtOrAfter),
            timeInYears
        ) - ONE_WEI;

        uint256 beforeOrAtRateValueWei = WadRayMath.rayToWad(beforeOrAtRateValue);
        uint256 rateValueWei = PRBMathUD60x18.mul(beforeOrAtRateValueWei, exp1);
        rateValue = WadRayMath.wadToRay(rateValueWei);
    }

    /// @inheritdoc IRateOracle
    function observeSingle(
        uint256 currentTime,
        uint256 queriedTime,
        uint16 index,
        uint16 cardinality
    )
        public
        view
        override(BaseRateOracle, IRateOracle)
        returns (uint256 rateValue)
    {
        if (currentTime == queriedTime) {
            Rate memory rate;
            rate = rates[index];
            if (rate.timestamp != currentTime) {
                rateValue = IAaveV2LendingPool(aaveLendingPool)
                    .getReserveNormalizedIncome(underlying);
            } else {
                rateValue = rate.rateValue;
            }
        }

        (Rate memory beforeOrAt, Rate memory atOrAfter) = getSurroundingRates(
            queriedTime,
            index,
            cardinality
        );

        if (queriedTime == beforeOrAt.timestamp) {
            // we are at the left boundary
            rateValue = beforeOrAt.rateValue;
        } else if (queriedTime == atOrAfter.timestamp) {
            // we are at the right boundary
            rateValue = atOrAfter.rateValue;
        } else {
            // we are in the middle
            // find apy between beforeOrAt and atOrAfter

            uint256 rateFromBeforeOrAtToAtOrAfter;

            if (atOrAfter.rateValue > beforeOrAt.rateValue) {
                rateFromBeforeOrAtToAtOrAfter = WadRayMath
                    .rayDiv(atOrAfter.rateValue, beforeOrAt.rateValue)
                    .sub(WadRayMath.RAY);
            }

            uint256 timeInYears = FixedAndVariableMath.accrualFact(
                atOrAfter.timestamp - beforeOrAt.timestamp
            );
            uint256 apyFromBeforeOrAtToAtOrAfter = computeApyFromRate(
                rateFromBeforeOrAtToAtOrAfter,
                timeInYears
            );

            // interpolate rateValue for queriedTime
            rateValue = interpolateRateValue(
                beforeOrAt.rateValue,
                apyFromBeforeOrAtToAtOrAfter,
                queriedTime - beforeOrAt.timestamp
            );
        }
    }

    function writeOracleEntry() external override(BaseRateOracle, IRateOracle) {
        (oracleVars.rateIndex, oracleVars.rateCardinality) = writeRate(
            oracleVars.rateIndex,
            oracleVars.rateCardinality,
            oracleVars.rateCardinalityNext
        );
    }

    /// @inheritdoc IRateOracle
    function getHistoricalApy()
        public
        view
        virtual
        override(BaseRateOracle, IRateOracle)
        returns (uint256 historicalApy)
    {
        // should not be virtual (had to do this for the tests)

        uint256 to = Time.blockTimestampScaled();
        uint256 from = to - secondsAgo;

        return getApyFromTo(from, to);
    }

    /// @inheritdoc IRateOracle
    function initialize() public override(BaseRateOracle, IRateOracle) {
        oracleVars.rateCardinalityNext = 1;
        oracleVars.rateCardinality = 1;

        (oracleVars.rateIndex, oracleVars.rateCardinality) = writeRate(
            oracleVars.rateIndex,
            oracleVars.rateCardinality,
            oracleVars.rateCardinalityNext
        );
    }
}
