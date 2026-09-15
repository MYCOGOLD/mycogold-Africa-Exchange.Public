import { Injectable } from "@nestjs/common";
@Injectable()
export class NewsService { search(query: string) { return { query, status: "adapter-not-configured" as const }; } }
