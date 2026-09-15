import { Injectable } from "@nestjs/common";
@Injectable()
export class OnlineLearnerService {
  proposeUpdate(modelVersion: string) { return { modelVersion, status: "requires-evaluation" as const }; }
}
