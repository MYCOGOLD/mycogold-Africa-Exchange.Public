import { Injectable } from "@nestjs/common";
@Injectable()
export class HistoricalEngine { backtest(formulaVersion: string) { return { formulaVersion, status: "not-run" as const }; } }
