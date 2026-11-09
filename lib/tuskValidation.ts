import type { Listing } from './supabase'

/**
 * Client-side completeness checks are not seller, photo, location, or quality
 * verification. This helper deliberately never emits verified=true or a
 * verification stamp. A future verification service must validate originals,
 * provenance, and hub data server-side.
 */
export function verifyListing(
  listing: Partial<Listing> & { photo_url?: string | null },
) {
  const price = Number(listing.price)
  const quantity = Number(listing.quantity)
  if (!Number.isFinite(price) || price <= 0) {
    return { verified: false, reason: 'Enter a valid positive price.', network_stamp: null }
  }
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return { verified: false, reason: 'Enter a valid positive quantity.', network_stamp: null }
  }
  if (!listing.photo_url) {
    return { verified: false, reason: 'A listing photo is required.', network_stamp: null }
  }
  if (!listing.location?.trim()) {
    return { verified: false, reason: 'A location is required.', network_stamp: null }
  }
  return {
    verified: false,
    reason: 'Basic listing details received. Independent photo, seller, location, and quality verification is not available yet.',
    network_stamp: null,
  }
}
