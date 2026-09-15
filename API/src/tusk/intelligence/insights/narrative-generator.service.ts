import { Injectable } from "@nestjs/common";
@Injectable()
export class NarrativeGeneratorService { summarize(input: string, language = "en") { return { input, language, status: "requires-evidence" as const }; } }
