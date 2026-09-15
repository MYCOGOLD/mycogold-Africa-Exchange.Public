import { Injectable } from "@nestjs/common";
@Injectable()
export class MarketStressTester { run(scenario: string) { return { scenario, status: "not-run" as const }; } }
