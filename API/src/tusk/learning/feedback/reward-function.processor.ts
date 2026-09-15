import { Injectable } from "@nestjs/common";
@Injectable()
export class RewardFunctionProcessor { evaluate(orderId: string) { return { orderId, status: "requires-finalized-outcome" as const }; } }
