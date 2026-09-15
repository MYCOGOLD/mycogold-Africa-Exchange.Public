import { Injectable } from "@nestjs/common";
@Injectable()
export class VendorScoringService { score(vendorId: string) { return { vendorId, score: null, reason: "insufficient-verified-history" as const }; } }
