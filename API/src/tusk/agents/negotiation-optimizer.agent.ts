import { Injectable } from "@nestjs/common";
@Injectable()
export class NegotiationOptimizerAgent {
  rankCandidates(listingId: string, candidateIds: string[]) { return { listingId, candidateIds, strategy: "human-confirmed-offer" as const }; }
}
