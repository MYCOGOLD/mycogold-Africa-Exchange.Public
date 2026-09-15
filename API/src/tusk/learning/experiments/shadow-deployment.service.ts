import { Injectable } from "@nestjs/common";
@Injectable()
export class ShadowDeploymentService { deploy(modelVersion: string) { return { modelVersion, mode: "shadow" as const }; } }
