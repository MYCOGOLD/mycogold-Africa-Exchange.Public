import { Injectable } from "@nestjs/common";
@Injectable()
export class FeatureAttributionService {
  explain(indexCode: string) { return { indexCode, factors: ["verified trade volume", "recency", "data quality"] }; }
}
