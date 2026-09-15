import { Injectable } from "@nestjs/common";
@Injectable()
export class LiquidityRouterService { route(orderId: string) { return { orderId, status: "requires-location-and-logistics-data" as const }; } }
