import { Injectable } from "@nestjs/common";
@Injectable()
export class FlashCrashShieldService { inspect(indexCode: string) { return { indexCode, blocked: false, status: "monitoring" as const }; } }
