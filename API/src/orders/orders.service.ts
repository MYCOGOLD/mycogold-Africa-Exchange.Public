import { Injectable } from "@nestjs/common";

export type OrderStatus = "pending" | "accepted" | "settled" | "cancelled";
export type ExchangeOrder = { id: string; listingId: string; status: OrderStatus };

@Injectable()
export class OrdersService {
  getStatus(orderId: string): ExchangeOrder {
    return { id: orderId, listingId: "pending-listing", status: "pending" };
  }
}
