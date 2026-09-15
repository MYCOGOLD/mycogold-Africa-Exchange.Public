import { Injectable } from "@nestjs/common";
@Injectable()
export class ValidationService {
  validate(modelVersion: string) { return { modelVersion, passed: false, status: "not-run" as const }; }
}
