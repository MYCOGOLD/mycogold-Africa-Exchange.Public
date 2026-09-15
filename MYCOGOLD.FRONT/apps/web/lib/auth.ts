export type SessionUser = { id: string; name: string; role: "farmer" | "buyer" | "admin" };
export function getSessionUser(): SessionUser | null { return null; }
