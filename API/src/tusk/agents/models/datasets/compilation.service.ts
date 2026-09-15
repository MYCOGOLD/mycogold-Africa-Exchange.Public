import { Injectable } from "@nestjs/common";
@Injectable()
export class CompilationService {
  compileVerifiedTrades(tradeIds: string[]) { return { tradeIds, source: "verified-completed-trades" as const }; }
}
