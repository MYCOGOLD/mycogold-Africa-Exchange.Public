import { Injectable } from "@nestjs/common";
@Injectable()
export class HashtagVelocityService { measure(tag: string) { return { tag, velocity: 0, confidence: "low" as const }; } }
