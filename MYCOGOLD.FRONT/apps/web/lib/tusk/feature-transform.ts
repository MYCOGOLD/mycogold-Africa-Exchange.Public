import type { TuskListingDraft } from "../../types/tusk";
export function normalizeListingDraft(draft: TuskListingDraft): TuskListingDraft { return { ...draft, product: draft.product?.trim(), location: draft.location?.trim() }; }
