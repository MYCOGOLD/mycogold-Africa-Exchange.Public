import { Module } from "@nestjs/common";
import { HealthController } from "./health.controller";
import { MarketController } from "./market/market.controller";
import { TuskController } from "./tusk/tusk.controller";
import { AuthModule } from "./auth/auth.module";
import { UsersModule } from "./users/users.module";
import { ProductsModule } from "./products/products.module";
import { MarketplaceModule } from "./marketplace/marketplace.module";
import { OrdersModule } from "./orders/orders.module";
import { PaymentsModule } from "./payments/payments.module";
import { WalletsModule } from "./wallets/wallets.module";
import { LedgerModule } from "./ledger/ledger.module";
import { MarketModule } from "./market/market.module";
import { IndexModule } from "./index/index.module";
import { NotificationsModule } from "./notifications/notifications.module";
import { AdminModule } from "./admin/admin.module";
import { TuskModule } from "./tusk/tusk.module";

@Module({
  imports: [
    AuthModule, UsersModule, ProductsModule, MarketplaceModule, OrdersModule,
    PaymentsModule, WalletsModule, LedgerModule, MarketModule, IndexModule,
    NotificationsModule, AdminModule, TuskModule
  ],
  controllers: [HealthController, MarketController, TuskController]
})
export class AppModule {}
