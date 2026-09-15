import { Module } from "@nestjs/common";
import { RegionalTrackerService } from "./market/regional-tracker.service";
import { HashtagVelocityService } from "./signals/hashtag-velocity.service";
import { NarrativeGeneratorService } from "./insights/narrative-generator.service";
import { VendorScoringService } from "./insights/ranking/vendor-scoring.service";
import { FlashCrashShieldService } from "./insights/anomaly/flash-crash-shield.service";
@Module({ providers: [RegionalTrackerService, HashtagVelocityService, NarrativeGeneratorService, VendorScoringService, FlashCrashShieldService], exports: [RegionalTrackerService] })
export class IntelligenceModule {}
