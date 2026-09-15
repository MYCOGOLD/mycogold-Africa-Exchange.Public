import { Injectable } from "@nestjs/common";

@Injectable()
export class OrderMatchingProcessor {
  matchListingToOffer(listingId: string, offerId: string) {
    return { listingId, offerId, status: "ready-for-human-confirmation" as const };
  }
}
