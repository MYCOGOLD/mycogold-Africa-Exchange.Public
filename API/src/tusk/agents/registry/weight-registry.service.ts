import { Injectable } from "@nestjs/common";
@Injectable()
export class WeightRegistryService {
  activeWeights() { return { verifiedTradeVolume: 0.45, recency: 0.25, locationMatch: 0.2, dataQuality: 0.1 }; }
}
