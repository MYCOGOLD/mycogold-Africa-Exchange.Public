import { Injectable } from "@nestjs/common";
@Injectable()
export class RegionalTrackerService { track(region: string) { return { region, status: "awaiting-verified-trade-events" as const }; } }
