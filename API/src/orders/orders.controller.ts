import { Controller, Get, Param } from "@nestjs/common";
import { OrdersService } from "./orders.service";

@Controller("orders")
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get(":orderId")
  getStatus(@Param("orderId") orderId: string) {
    return this.ordersService.getStatus(orderId);
  }
}
