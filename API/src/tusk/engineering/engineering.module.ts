import { Module } from "@nestjs/common";
import { MarketStressTester } from "./simulation/market-stress.tester";
import { MultiVariableCompiler } from "./formula-engine/multi-variable.compiler";
import { LiquidityRouterService } from "./optimization/liquidity-router.service";
import { HistoricalEngine } from "./backtesting/historical-engine";
@Module({ providers: [MarketStressTester, MultiVariableCompiler, LiquidityRouterService, HistoricalEngine], exports: [MultiVariableCompiler] })
export class EngineeringModule {}
