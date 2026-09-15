import { Controller, Get } from "@nestjs/common";

@Controller("market")
export class MarketController {
  @Get("snapshot")
  snapshot() {
    return {
      index: "MCG-TOMATO-TZ-ARUSHA",
      value: 1980,
      currency: "TZS",
      unit: "kg",
      completedTrades: 12,
      tradedVolume: 4800,
      confidence: "medium"
    };
  }
}
