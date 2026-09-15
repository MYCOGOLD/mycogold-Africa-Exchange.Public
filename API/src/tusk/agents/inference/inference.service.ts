import { Injectable } from "@nestjs/common";
@Injectable()
export class InferenceService {
  classify(text: string) { return { text, intent: "unknown" as const, confidence: 0, modelVersion: "tusk-parser-0.1" }; }
}
