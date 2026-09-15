import { Injectable } from "@nestjs/common";
@Injectable()
export class MarketDataService { fetch(source: string) { return { source, status: "adapter-not-configured" as const }; } }
