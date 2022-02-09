import { Wallet, BigNumber } from "ethers";
import { expect } from "chai";
import { ethers, waffle } from "hardhat";
import { toBn } from "evm-bn";
import { marginCalculatorFixture } from "../shared/fixtures";
import {
  APY_UPPER_MULTIPLIER,
  APY_LOWER_MULTIPLIER,
  MIN_DELTA_LM,
  MIN_DELTA_IM,
  SIGMA_SQUARED,
  ALPHA,
  BETA,
  XI_UPPER,
  XI_LOWER,
  T_MAX,
} from "../shared/utilities";

import { MarginCalculatorTest } from "../../typechain/MarginCalculatorTest";
import { getCurrentTimestamp } from "../helpers/time";

const createFixtureLoader = waffle.createFixtureLoader;
const { provider } = waffle;

describe("MarginCalculator", () => {
  // - Setup

  let wallet: Wallet, other: Wallet;

  let loadFixture: ReturnType<typeof createFixtureLoader>;
  before("create fixture loader", async () => {
    [wallet, other] = await (ethers as any).getSigners();

    loadFixture = createFixtureLoader([wallet, other]);
  });

  describe("#computeTimeFactor", async () => {
    let margin_engine_params: any;
    let testMarginCalculator: MarginCalculatorTest;

    beforeEach("deploy calculator", async () => {
      margin_engine_params = {
        apyUpperMultiplierWad: APY_UPPER_MULTIPLIER,
        apyLowerMultiplierWad: APY_LOWER_MULTIPLIER,
        minDeltaLMWad: MIN_DELTA_LM,
        minDeltaIMWad: MIN_DELTA_IM,
        sigmaSquaredWad: SIGMA_SQUARED,
        alphaWad: ALPHA,
        betaWad: BETA,
        xiUpperWad: XI_UPPER,
        xiLowerWad: XI_LOWER,
        tMaxWad: T_MAX,
      };

      ({ testMarginCalculator } = await loadFixture(marginCalculatorFixture));
    });

    it("reverts if termEndTimestamp isn't > 0", async () => {
      await expect(
        testMarginCalculator.computeTimeFactor(
          toBn("0"),
          toBn("1"),
          margin_engine_params
        )
      ).to.be.revertedWith("termEndTimestamp must be > 0");
    });

    it("reverts if currentTimestamp is larger than termEndTimestamp", async () => {
      await expect(
        testMarginCalculator.computeTimeFactor(
          toBn("1"),
          toBn("2"),
          margin_engine_params
        )
      ).to.be.revertedWith("endTime must be > currentTime");
    });

    it("correctly computes the time factor", async () => {
      const currentTimestamp = await getCurrentTimestamp(provider);

      const termEndTimestampScaled = toBn(
        (currentTimestamp + 604800).toString() // add a week
      );

      const realized = await testMarginCalculator.computeTimeFactor(
        termEndTimestampScaled,
        toBn(currentTimestamp.toString()),
        margin_engine_params
      );

      expect(realized).to.be.eq("981004647228725753");
    });
  });

  describe("#computeApyBound", async () => {
    let margin_engine_params: any;
    let testMarginCalculator: MarginCalculatorTest;

    beforeEach("deploy calculator", async () => {
      margin_engine_params = {
        apyUpperMultiplierWad: APY_UPPER_MULTIPLIER,
        apyLowerMultiplierWad: APY_LOWER_MULTIPLIER,
        minDeltaLMWad: MIN_DELTA_LM,
        minDeltaIMWad: MIN_DELTA_IM,
        sigmaSquaredWad: SIGMA_SQUARED,
        alphaWad: ALPHA,
        betaWad: BETA,
        xiUpperWad: XI_UPPER,
        xiLowerWad: XI_LOWER,
        tMaxWad: T_MAX,
      };

      ({ testMarginCalculator } = await loadFixture(marginCalculatorFixture));
    });

    // passes
    it("correctly computes the Upper APY Bound", async () => {
      const currentTimestamp = await getCurrentTimestamp(provider);

      const termEndTimestampScaled = toBn(
        (currentTimestamp + 604800).toString() // add a week
      );

      const currentTimestampScaled = toBn(currentTimestamp.toString());

      const historicalApy: BigNumber = toBn("0.02");
      const isUpper: boolean = true;

      expect(
        await testMarginCalculator.computeApyBound(
          termEndTimestampScaled,
          currentTimestampScaled,
          historicalApy,
          isUpper,
          margin_engine_params
        )
      ).to.eq("24278147968583284");
    });

    // passes
    it("correctly computes the Lower APY Bound", async () => {
      const currentTimestamp = await getCurrentTimestamp(provider);

      const termEndTimestampScaled = toBn(
        (currentTimestamp + 604800).toString() // add a week
      );

      const currentTimestampScaled = toBn(currentTimestamp.toString());

      const historicalApy: BigNumber = toBn("0.02");
      const isUpper: boolean = false;

      expect(
        await testMarginCalculator.computeApyBound(
          termEndTimestampScaled,
          currentTimestampScaled,
          historicalApy,
          isUpper,
          margin_engine_params
        )
      ).to.eq("17456226370556757");
    });
  });

  describe("#worstCaseVariableFactorAtMaturity", async () => {
    let margin_engine_params: any;
    let testMarginCalculator: MarginCalculatorTest;

    beforeEach("deploy calculator", async () => {
      margin_engine_params = {
        apyUpperMultiplierWad: APY_UPPER_MULTIPLIER,
        apyLowerMultiplierWad: APY_LOWER_MULTIPLIER,
        minDeltaLMWad: MIN_DELTA_LM,
        minDeltaIMWad: MIN_DELTA_IM,
        sigmaSquaredWad: SIGMA_SQUARED,
        alphaWad: ALPHA,
        betaWad: BETA,
        xiUpperWad: XI_UPPER,
        xiLowerWad: XI_LOWER,
        tMaxWad: T_MAX,
      };

      ({ testMarginCalculator } = await loadFixture(marginCalculatorFixture));
    });

    it("correctly calculates the worst case variable factor at maturity FT, LM", async () => {
      const currentTimestamp = await getCurrentTimestamp(provider);

      const termEndTimestampScaled = toBn(
        (currentTimestamp + 604800).toString() // add a week
      );

      const currentTimestampScaled = toBn(currentTimestamp.toString());

      const timeInSecondsFromStartToMaturityBN = toBn("1209600"); // two weeks
      const isFT = true;
      const isLM = true;
      const historicalApy = toBn("0.1");

      const realized =
        await testMarginCalculator.worstCaseVariableFactorAtMaturity(
          timeInSecondsFromStartToMaturityBN,
          termEndTimestampScaled,
          currentTimestampScaled,
          isFT,
          isLM,
          historicalApy,
          margin_engine_params
        );

      expect(realized).to.eq("4123691408399440");
    });

    it("correctly calculates the worst case variable factor at maturity FT, IM", async () => {
      const currentTimestamp = await getCurrentTimestamp(provider);

      const termEndTimestampScaled = toBn(
        (currentTimestamp + 604800).toString() // add a week
      );

      const currentTimestampScaled = toBn(currentTimestamp.toString());

      const timeInSecondsFromStartToMaturityBN = toBn("1209600"); // two weeks
      const isFT = true;
      const isLM = false;
      const historicalApy = toBn("0.1");

      const realized =
        await testMarginCalculator.worstCaseVariableFactorAtMaturity(
          timeInSecondsFromStartToMaturityBN,
          termEndTimestampScaled,
          currentTimestampScaled,
          isFT,
          isLM,
          historicalApy,
          margin_engine_params
        );

      expect(realized).to.eq("6185537112599160");
    });

    it("correctly calculates the worst case variable factor at maturity VT, LM", async () => {
      const currentTimestamp = await getCurrentTimestamp(provider);

      const termEndTimestampScaled = toBn(
        (currentTimestamp + 604800).toString() // add a week
      );

      const currentTimestampScaled = toBn(currentTimestamp.toString());

      const timeInSecondsFromStartToMaturityBN = toBn("1209600"); // two weeks
      const isFT = false;
      const isLM = true;
      const historicalApy = toBn("0.1");

      const realized =
        await testMarginCalculator.worstCaseVariableFactorAtMaturity(
          timeInSecondsFromStartToMaturityBN,
          termEndTimestampScaled,
          currentTimestampScaled,
          isFT,
          isLM,
          historicalApy,
          margin_engine_params
        );

      expect(realized).to.eq("3543058379114670");
    });

    it("correctly calculates the worst case variable factor at maturity VT, IM", async () => {
      const currentTimestamp = await getCurrentTimestamp(provider);

      const termEndTimestampScaled = toBn(
        (currentTimestamp + 604800).toString() // add a week
      );

      const currentTimestampScaled = toBn(currentTimestamp.toString());

      const timeInSecondsFromStartToMaturityBN = toBn("1209600"); // two weeks
      const isFT = false;
      const isLM = false;
      const historicalApy = toBn("0.1");

      const realized =
        await testMarginCalculator.worstCaseVariableFactorAtMaturity(
          timeInSecondsFromStartToMaturityBN,
          termEndTimestampScaled,
          currentTimestampScaled,
          isFT,
          isLM,
          historicalApy,
          margin_engine_params
        );

      expect(realized).to.eq("2480140865380269");
    });
  });

  // describe("#getTraderMarginRequirement", async () => {
  //   let margin_engine_params: any;
  //   let testMarginCalculator: MarginCalculatorTest;

  //   beforeEach("deploy calculator", async () => {
  //     margin_engine_params = {
  //       apyUpperMultiplierWad: APY_UPPER_MULTIPLIER,
  //       apyLowerMultiplierWad: APY_LOWER_MULTIPLIER,
  //       minDeltaLMWad: MIN_DELTA_LM,
  //       minDeltaIMWad: MIN_DELTA_IM,
  //       sigmaSquaredWad: SIGMA_SQUARED,
  //       alphaWad: ALPHA,
  //       betaWad: BETA,
  //       xiUpperWad: XI_UPPER,
  //       xiLowerWad: XI_LOWER,
  //       tMaxWad: T_MAX,
  //     };

  //     ({ testMarginCalculator } = await loadFixture(marginCalculatorFixture));
  //   });

  //   it("correctly calculates the trader margin requirement: FT, LM", async () => {
  //     const fixedTokenBalance: BigNumber = toBn("1000");
  //     const variableTokenBalance: BigNumber = toBn("-30");

  //     const currentTimestamp = await getCurrentTimestamp(provider);

  //     const termEndTimestampScaled = toBn(
  //       (currentTimestamp + 604800).toString() // add a week
  //     );

  //     const termStartTimestampScaled = toBn(
  //       (currentTimestamp - 604800).toString()
  //     );
  //     const isLM = true;
  //     const historicalApy = toBn("0.0");

  //     const trader_margin_requirement_params = {
  //       fixedTokenBalance: fixedTokenBalance,
  //       variableTokenBalance: variableTokenBalance,
  //       termStartTimestampWad: termStartTimestampScaled,
  //       termEndTimestampWad: termEndTimestampScaled,
  //       isLM: isLM,
  //       historicalApyWad: historicalApy,
  //     };

  //     const realized = await testMarginCalculator.getTraderMarginRequirement(
  //       trader_margin_requirement_params,
  //       margin_engine_params
  //     );

  //     expect(realized).to.eq(0);
  //   });

  //   it("correctly calculates the trader margin requirement: FT, LM with <0", async () => {
  //     const fixedTokenBalance: BigNumber = toBn("10");
  //     const variableTokenBalance: BigNumber = toBn("-30000000");

  //     const currentTimestamp = await getCurrentTimestamp(provider);

  //     const termEndTimestampScaled = toBn(
  //       (currentTimestamp + 604800).toString() // add a week
  //     );

  //     const termStartTimestampScaled = toBn(
  //       (currentTimestamp - 604800).toString()
  //     );
  //     const isLM = true;
  //     const historicalApy = toBn("0.1");

  //     const trader_margin_requirement_params = {
  //       fixedTokenBalance: fixedTokenBalance,
  //       variableTokenBalance: variableTokenBalance,
  //       termStartTimestampWad: termStartTimestampScaled,
  //       termEndTimestampWad: termEndTimestampScaled,
  //       isLM: isLM,
  //       historicalApyWad: historicalApy,
  //     };

  //     const realized = await testMarginCalculator.getTraderMarginRequirement(
  //       trader_margin_requirement_params,
  //       margin_engine_params
  //     );

  //     expect(realized).to.eq(toBn("123710.738416366761643840"));
  //   });

  //   it("correctly calculates the trader margin requirement: FT, IM", async () => {
  //     const fixedTokenBalance: BigNumber = toBn("1000");
  //     const variableTokenBalance: BigNumber = toBn("-30");

  //     const currentTimestamp = await getCurrentTimestamp(provider);

  //     const termEndTimestampScaled = toBn(
  //       (currentTimestamp + 604800).toString() // add a week
  //     );

  //     const termStartTimestampScaled = toBn(
  //       (currentTimestamp - 604800).toString()
  //     );
  //     const isLM = false;
  //     const historicalApy = toBn("0.1");

  //     const trader_margin_requirement_params = {
  //       fixedTokenBalance: fixedTokenBalance,
  //       variableTokenBalance: variableTokenBalance,
  //       termStartTimestampWad: termStartTimestampScaled,
  //       termEndTimestampWad: termEndTimestampScaled,
  //       isLM: isLM,
  //       historicalApyWad: historicalApy,
  //     };

  //     const realized = await testMarginCalculator.getTraderMarginRequirement(
  //       trader_margin_requirement_params,
  //       margin_engine_params
  //     );

  //     expect(realized).to.eq("0");
  //   });

  //   it("correctly calculates the trader margin requirement: FT, IM with <0", async () => {
  //     const fixedTokenBalance: BigNumber = toBn("1000");
  //     const variableTokenBalance: BigNumber = toBn("-3000");

  //     const currentTimestamp = await getCurrentTimestamp(provider);

  //     const termEndTimestampScaled = toBn(
  //       (currentTimestamp + 604800).toString() // add a week
  //     );

  //     const termStartTimestampScaled = toBn(
  //       (currentTimestamp - 604800).toString()
  //     );
  //     const isLM = false;
  //     const historicalApy = toBn("0.1");

  //     const trader_margin_requirement_params = {
  //       fixedTokenBalance: fixedTokenBalance,
  //       variableTokenBalance: variableTokenBalance,
  //       termStartTimestampWad: termStartTimestampScaled,
  //       termEndTimestampWad: termEndTimestampScaled,
  //       isLM: isLM,
  //       historicalApyWad: historicalApy,
  //     };

  //     const realized = await testMarginCalculator.getTraderMarginRequirement(
  //       trader_margin_requirement_params,
  //       margin_engine_params
  //     );

  //     expect(realized).to.eq(toBn("18.173049693961864"));
  //   });

  //   it("correctly calculates the trader margin requirement: VT, LM", async () => {
  //     const fixedTokenBalance: BigNumber = toBn("-1000");
  //     const variableTokenBalance: BigNumber = toBn("3000");

  //     const currentTimestamp = await getCurrentTimestamp(provider);

  //     const termEndTimestampScaled = toBn(
  //       (currentTimestamp + 604800).toString() // add a week
  //     );

  //     const termStartTimestampScaled = toBn(
  //       (currentTimestamp - 604800).toString()
  //     );
  //     const isLM = true;
  //     const historicalApy = toBn("0.1");

  //     const trader_margin_requirement_params = {
  //       fixedTokenBalance: fixedTokenBalance,
  //       variableTokenBalance: variableTokenBalance,
  //       termStartTimestampWad: termStartTimestampScaled,
  //       termEndTimestampWad: termEndTimestampScaled,
  //       isLM: isLM,
  //       historicalApyWad: historicalApy,
  //     };

  //     const realized = await testMarginCalculator.getTraderMarginRequirement(
  //       trader_margin_requirement_params,
  //       margin_engine_params
  //     );

  //     expect(realized).to.eq(0);
  //   });

  //   it("correctly calculates the trader margin requirement: FT, IM", async () => {
  //     const fixedTokenBalance: BigNumber = toBn("-1000");
  //     const variableTokenBalance: BigNumber = toBn("3000");

  //     const currentTimestamp = await getCurrentTimestamp(provider);

  //     const termEndTimestampScaled = toBn(
  //       (currentTimestamp + 604800).toString() // add a week
  //     );

  //     const termStartTimestampScaled = toBn(
  //       (currentTimestamp - 604800).toString()
  //     );
  //     const isLM = false;
  //     const historicalApy = toBn("0.1");

  //     const trader_margin_requirement_params = {
  //       fixedTokenBalance: fixedTokenBalance,
  //       variableTokenBalance: variableTokenBalance,
  //       termStartTimestampWad: termStartTimestampScaled,
  //       termEndTimestampWad: termEndTimestampScaled,
  //       isLM: isLM,
  //       historicalApyWad: historicalApy,
  //     };

  //     const realized = await testMarginCalculator.getTraderMarginRequirement(
  //       trader_margin_requirement_params,
  //       margin_engine_params
  //     );

  //     console.log(realized.toString());
  //     expect(realized).to.eq(0);
  //   });
  // });

  // describe("#isLiquiisLiquidatableTrader", async () => {
  //   let margin_engine_params: any;
  //   let testMarginCalculator: MarginCalculatorTest;

  //   beforeEach("deploy calculator", async () => {
  //     margin_engine_params = {
  //       apyUpperMultiplierWad: APY_UPPER_MULTIPLIER,
  //       apyLowerMultiplierWad: APY_LOWER_MULTIPLIER,
  //       minDeltaLMWad: MIN_DELTA_LM,
  //       minDeltaIMWad: MIN_DELTA_IM,
  //       sigmaSquaredWad: SIGMA_SQUARED,
  //       alphaWad: ALPHA,
  //       betaWad: BETA,
  //       xiUpperWad: XI_UPPER,
  //       xiLowerWad: XI_LOWER,
  //       tMaxWad: T_MAX,
  //     };

  //     ({ testMarginCalculator } = await loadFixture(marginCalculatorFixture));
  //   });

  //   it("correctly checks for the fact the trader is liquidatable", async () => {
  //     const fixedTokenBalance: BigNumber = toBn("-1000");
  //     const variableTokenBalance: BigNumber = toBn("3000");

  //     const currentTimestamp = await getCurrentTimestamp(provider);

  //     const termEndTimestampScaled = toBn(
  //       (currentTimestamp + 604800).toString() // add a week
  //     );

  //     const termStartTimestampScaled = toBn(
  //       (currentTimestamp - 604800).toString()
  //     );
  //     const isLM = false;
  //     const historicalApy = toBn("0.1");

  //     const trader_margin_requirement_params = {
  //       fixedTokenBalance: fixedTokenBalance,
  //       variableTokenBalance: variableTokenBalance,
  //       termStartTimestampWad: termStartTimestampScaled,
  //       termEndTimestampWad: termEndTimestampScaled,
  //       isLM: isLM,
  //       historicalApyWad: historicalApy,
  //     };

  //     const currentMargin = toBn("0.0");

  //     const realized = await testMarginCalculator.isLiquidatableTrader(
  //       trader_margin_requirement_params,
  //       currentMargin,
  //       margin_engine_params
  //     );
  //     expect(realized).to.be.eq(false);
  //   });
  // });

  // describe("#isLiquiisLiquidatablePosition", async () => {
  //   let margin_engine_params: any;
  //   let testMarginCalculator: MarginCalculatorTest;

  //   beforeEach("deploy calculator", async () => {
  //     margin_engine_params = {
  //       apyUpperMultiplierWad: APY_UPPER_MULTIPLIER,
  //       apyLowerMultiplierWad: APY_LOWER_MULTIPLIER,
  //       minDeltaLMWad: MIN_DELTA_LM,
  //       minDeltaIMWad: MIN_DELTA_IM,
  //       sigmaSquaredWad: SIGMA_SQUARED,
  //       alphaWad: ALPHA,
  //       betaWad: BETA,
  //       xiUpperWad: XI_UPPER,
  //       xiLowerWad: XI_LOWER,
  //       tMaxWad: T_MAX,
  //     };

  //     ({ testMarginCalculator } = await loadFixture(marginCalculatorFixture));
  //   });

  //   it("correctly checks for the fact the position is liquidatable", async () => {
  //     const tickLower: number = 100;
  //     const tickUpper: number = 1000;
  //     const currentTick: number = 0;

  //     const currentTimestamp = (await getCurrentTimestamp(provider)) + 1;

  //     const termStartTimestamp = currentTimestamp - 604800;

  //     const termEndTimestampScaled = toBn(
  //       (termStartTimestamp + 604800).toString() // add a week
  //     );

  //     const termStartTimestampScaled = toBn(termStartTimestamp.toString());

  //     const fixedTokenBalance: BigNumber = toBn("0");
  //     const variableTokenBalance: BigNumber = toBn("0");

  //     const variableFactor: BigNumber = toBn("0.00");
  //     const historicalApy: BigNumber = toBn("0.0");
  //     const liquidityBN: BigNumber = expandTo18Decimals(1);
  //     const currentMargin = toBn("0.0");

  //     const isLM = false;

  //     const position_margin_requirement_params = {
  //       owner: wallet.address,
  //       tickLower: tickLower,
  //       tickUpper: tickUpper,
  //       isLM: isLM,
  //       currentTick: currentTick,
  //       termStartTimestampWad: termStartTimestampScaled,
  //       termEndTimestampWad: termEndTimestampScaled,
  //       liquidity: liquidityBN,
  //       fixedTokenBalance: fixedTokenBalance,
  //       variableTokenBalance: variableTokenBalance,
  //       variableFactorWad: variableFactor,
  //       historicalApyWad: historicalApy,
  //     };

  //     const realized = await testMarginCalculator.isLiquidatablePosition(
  //       position_margin_requirement_params,
  //       currentMargin,
  //       margin_engine_params
  //     );

  //     expect(realized).to.eq(true);
  //   });
  // });

  // describe("#getPositionMarginRequirement", async () => {
  //   let margin_engine_params: any;
  //   let testMarginCalculator: MarginCalculatorTest;
  //   let testFixedAndVariableMath: FixedAndVariableMathTest;

  //   beforeEach("deploy calculator", async () => {
  //     margin_engine_params = {
  //       apyUpperMultiplierWad: APY_UPPER_MULTIPLIER,
  //       apyLowerMultiplierWad: APY_LOWER_MULTIPLIER,
  //       minDeltaLMWad: MIN_DELTA_LM,
  //       minDeltaIMWad: MIN_DELTA_IM,
  //       sigmaSquaredWad: SIGMA_SQUARED,
  //       alphaWad: ALPHA,
  //       betaWad: BETA,
  //       xiUpperWad: XI_UPPER,
  //       xiLowerWad: XI_LOWER,
  //       tMaxWad: T_MAX,
  //     };

  //     ({ testMarginCalculator } = await loadFixture(marginCalculatorFixture));
  //     ({ testFixedAndVariableMath } = await loadFixture(
  //       fixedAndVariableMathFixture
  //     ));
  //   });

  //   it("current tick < lower tick: margin requirement for staying position", async () => {
  //     const tickLower: number = 100;
  //     const tickUpper: number = 1000;
  //     const currentTick: number = 0;

  //     const currentTimestamp = await getCurrentTimestamp(provider);
  //     const currentTimestampScaled = toBn(currentTimestamp.toString());

  //     const termStartTimestamp = currentTimestamp - 604800;

  //     const termEndTimestampScaled = toBn(
  //       (termStartTimestamp + 2 * 604800).toString() // add two weeks
  //     );

  //     const termStartTimestampScaled = toBn(termStartTimestamp.toString());

  //     const fixedTokenBalance: BigNumber = toBn("-100");
  //     const variableTokenBalance: BigNumber = toBn("100");

  //     const variableFactor: BigNumber = toBn("0.02");
  //     const historicalApy: BigNumber = toBn("0.3");
  //     const liquidityBN: BigNumber = expandTo18Decimals(1000);

  //     const isLM = true;

  //     const position_margin_requirement_params = {
  //       owner: wallet.address,
  //       tickLower: tickLower,
  //       tickUpper: tickUpper,
  //       isLM: isLM,
  //       currentTick: currentTick,
  //       termStartTimestampWad: termStartTimestampScaled,
  //       termEndTimestampWad: termEndTimestampScaled,
  //       liquidity: liquidityBN,
  //       fixedTokenBalance: fixedTokenBalance,
  //       variableTokenBalance: variableTokenBalance,
  //       variableFactorWad: variableFactor,
  //       historicalApyWad: historicalApy,
  //     };

  //     const timeFactor = await testMarginCalculator.computeTimeFactor(
  //       termEndTimestampScaled,
  //       currentTimestampScaled,
  //       margin_engine_params
  //     );
  //     console.log("time factor: ", timeFactor.toString());

  //     const liquidityJSBI: JSBI = JSBI.BigInt(liquidityBN.toString());

  //     const amount0DeltaJSBI = SqrtPriceMath.getAmount0Delta(
  //       TickMath.getSqrtRatioAtTick(tickLower),
  //       TickMath.getSqrtRatioAtTick(tickUpper),
  //       liquidityJSBI,
  //       false
  //     );

  //     const amount1DeltaJSBI = SqrtPriceMath.getAmount1Delta(
  //       TickMath.getSqrtRatioAtTick(tickLower),
  //       TickMath.getSqrtRatioAtTick(tickUpper),
  //       liquidityJSBI,
  //       true
  //     );

  //     let amount0Delta = BigNumber.from(amount0DeltaJSBI.toString());
  //     const amount1Delta = BigNumber.from(amount1DeltaJSBI.toString());

  //     amount0Delta = mul(amount0Delta, toBn("-1.0"));

  //     console.log("amount0 contract: ", amount0Delta.toString());
  //     console.log("amount1 contract: ", amount1Delta.toString());

  //     const extraFixedTokenBalance =
  //       await testFixedAndVariableMath.getFixedTokenBalance(
  //         amount0Delta,
  //         amount1Delta,
  //         variableFactor,
  //         termStartTimestampScaled,
  //         termEndTimestampScaled
  //       );

  //     const scenario1LPVariableTokenBalance = add(
  //       variableTokenBalance,
  //       amount1Delta
  //     );
  //     const scenario1LPFixedTokenBalance = add(
  //       fixedTokenBalance,
  //       extraFixedTokenBalance
  //     );

  //     console.log("extraFixedTokenBalance", extraFixedTokenBalance.toString());
  //     console.log(
  //       "scenario1LPVariableTokenBalance",
  //       scenario1LPVariableTokenBalance.toString()
  //     );
  //     console.log(
  //       "scenario1LPFixedTokenBalance",
  //       scenario1LPFixedTokenBalance.toString()
  //     );

  //     const trader_margin_requirement_params_1 = {
  //       fixedTokenBalance: scenario1LPFixedTokenBalance,
  //       variableTokenBalance: scenario1LPVariableTokenBalance,
  //       termStartTimestampWad: termStartTimestampScaled,
  //       termEndTimestampWad: termEndTimestampScaled,
  //       isLM: isLM,
  //       historicalApyWad: historicalApy,
  //     };

  //     const tmReq1 = await testMarginCalculator.getTraderMarginRequirement(
  //       trader_margin_requirement_params_1,
  //       margin_engine_params
  //     );

  //     console.log("tmreq1:", tmReq1.toString());

  //     const trader_margin_requirement_params_2 = {
  //       fixedTokenBalance: fixedTokenBalance,
  //       variableTokenBalance: variableTokenBalance,
  //       termStartTimestampWad: termStartTimestampScaled,
  //       termEndTimestampWad: termEndTimestampScaled,
  //       isLM: isLM,
  //       historicalApyWad: historicalApy,
  //     };

  //     const tmReq2 = await testMarginCalculator.getTraderMarginRequirement(
  //       trader_margin_requirement_params_2,
  //       margin_engine_params
  //     );

  //     console.log("tmreq2:", tmReq2.toString());

  //     const realized =
  //       await testMarginCalculator.getPositionMarginRequirementTest(
  //         position_margin_requirement_params,
  //         margin_engine_params
  //       );

  //     console.log("margin: ", realized.toString());
  //     expect(realized.toString()).to.be.eq("0");
  //   });

  //   it("current tick < lower tick: margin requirement for changing position", async () => {
  //     const tickLower: number = 100;
  //     const tickUpper: number = 1000;
  //     const currentTick: number = 0;

  //     const currentTimestamp = await getCurrentTimestamp(provider);
  //     const currentTimestampScaled = toBn(currentTimestamp.toString());

  //     const termStartTimestamp = currentTimestamp - 604800;

  //     const termEndTimestampScaled = toBn(
  //       (termStartTimestamp + 2 * 604800).toString() // add two weeks
  //     );

  //     const termStartTimestampScaled = toBn(termStartTimestamp.toString());

  //     const fixedTokenBalance: BigNumber = toBn("0");
  //     const variableTokenBalance: BigNumber = toBn("0");

  //     const variableFactor: BigNumber = toBn("0.00");
  //     const historicalApy: BigNumber = toBn("0.0");
  //     const liquidityBN: BigNumber = expandTo18Decimals(1000000);

  //     const isLM = true;

  //     const position_margin_requirement_params = {
  //       owner: wallet.address,
  //       tickLower: tickLower,
  //       tickUpper: tickUpper,
  //       isLM: isLM,
  //       currentTick: currentTick,
  //       termStartTimestampWad: termStartTimestampScaled,
  //       termEndTimestampWad: termEndTimestampScaled,
  //       liquidity: liquidityBN,
  //       fixedTokenBalance: fixedTokenBalance,
  //       variableTokenBalance: variableTokenBalance,
  //       variableFactorWad: variableFactor,
  //       historicalApyWad: historicalApy,
  //     };

  //     const timeFactor = await testMarginCalculator.computeTimeFactor(
  //       termEndTimestampScaled,
  //       currentTimestampScaled,
  //       margin_engine_params
  //     );
  //     console.log("time factor: ", timeFactor.toString());

  //     const liquidityJSBI: JSBI = JSBI.BigInt(liquidityBN.toString());

  //     const amount0DeltaJSBI = SqrtPriceMath.getAmount0Delta(
  //       TickMath.getSqrtRatioAtTick(tickLower),
  //       TickMath.getSqrtRatioAtTick(tickUpper),
  //       liquidityJSBI,
  //       false
  //     );

  //     const amount1DeltaJSBI = SqrtPriceMath.getAmount1Delta(
  //       TickMath.getSqrtRatioAtTick(tickLower),
  //       TickMath.getSqrtRatioAtTick(tickUpper),
  //       liquidityJSBI,
  //       true
  //     );

  //     let amount0Delta = BigNumber.from(amount0DeltaJSBI.toString());
  //     const amount1Delta = BigNumber.from(amount1DeltaJSBI.toString());

  //     amount0Delta = mul(amount0Delta, toBn("-1.0"));

  //     console.log("amount0 contract: ", amount0Delta.toString());
  //     console.log("amount1 contract: ", amount1Delta.toString());

  //     const extraFixedTokenBalance =
  //       await testMarginCalculator.getFixedTokenBalanceFromMCTest(
  //         amount0Delta,
  //         amount1Delta,
  //         variableFactor,
  //         termStartTimestampScaled,
  //         termEndTimestampScaled
  //       );

  //     const scenario1LPVariableTokenBalance = add(
  //       variableTokenBalance,
  //       amount1Delta
  //     );
  //     const scenario1LPFixedTokenBalance = add(
  //       fixedTokenBalance,
  //       extraFixedTokenBalance
  //     );

  //     console.log("extraFixedTokenBalance", extraFixedTokenBalance.toString());
  //     console.log(
  //       "scenario1LPVariableTokenBalance",
  //       scenario1LPVariableTokenBalance.toString()
  //     );
  //     console.log(
  //       "scenario1LPFixedTokenBalance",
  //       scenario1LPFixedTokenBalance.toString()
  //     );

  //     const trader_margin_requirement_params_1 = {
  //       fixedTokenBalance: scenario1LPFixedTokenBalance,
  //       variableTokenBalance: scenario1LPVariableTokenBalance,
  //       termStartTimestampWad: termStartTimestampScaled,
  //       termEndTimestampWad: termEndTimestampScaled,
  //       isLM: isLM,
  //       historicalApyWad: historicalApy,
  //     };

  //     const tmReq1 = await testMarginCalculator.getTraderMarginRequirement(
  //       trader_margin_requirement_params_1,
  //       margin_engine_params
  //     );

  //     console.log("tmreq1:", tmReq1.toString());

  //     const trader_margin_requirement_params_2 = {
  //       fixedTokenBalance: fixedTokenBalance,
  //       variableTokenBalance: variableTokenBalance,
  //       termStartTimestampWad: termStartTimestampScaled,
  //       termEndTimestampWad: termEndTimestampScaled,
  //       isLM: isLM,
  //       historicalApyWad: historicalApy,
  //     };

  //     const tmReq2 = await testMarginCalculator.getTraderMarginRequirement(
  //       trader_margin_requirement_params_2,
  //       margin_engine_params
  //     );

  //     console.log("tmreq2:", tmReq2.toString());

  //     const realized =
  //       await testMarginCalculator.getPositionMarginRequirementTest(
  //         position_margin_requirement_params,
  //         margin_engine_params
  //       );

  //     console.log("margin: ", realized.toString());
  //     expect(realized.toString()).to.be.eq("7763193924954559178");
  //   });
  // });
});
