import { Module } from "@nestjs/common";
import { OrdersController } from "./orders.controller";
import { OrdersService } from "./orders.service";
import { OrderMatchingProcessor } from "./order-matching.processor";

@Module({ controllers: [OrdersController], providers: [OrdersService, OrderMatchingProcessor], exports: [OrdersService] })
export class OrdersModule {}
