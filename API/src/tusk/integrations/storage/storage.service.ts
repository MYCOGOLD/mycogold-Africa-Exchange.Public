import { Injectable } from "@nestjs/common";
@Injectable()
export class StorageService { createAuditReference(key: string) { return { key, status: "adapter-not-configured" as const }; } }
