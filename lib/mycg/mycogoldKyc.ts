export type KycStatus = "PENDING" | "VERIFIED" | "REJECTED";

const statuses = new Map<string, KycStatus>();

export function submitKyc(userId: string, idNumber: string, selfiePhoto: string) {
  if (!idNumber || !selfiePhoto) return { ok: false as const, error: "KYC_REQUIRED" };
  statuses.set(userId, "VERIFIED");
  return { ok: true as const, status: "VERIFIED" as const }; // TODO: real KYC provider later
}

export function requireKyc(userId: string): void {
  if ((statuses.get(userId) ?? "PENDING") !== "VERIFIED") throw new Error("KYC_REQUIRED");
}