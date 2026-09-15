import { Injectable } from "@nestjs/common";
@Injectable()
export class VectorDbService { search(query: string) { return { query, matches: [], status: "adapter-not-configured" as const }; } }
