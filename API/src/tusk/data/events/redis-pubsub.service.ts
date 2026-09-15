import { Injectable } from "@nestjs/common";
@Injectable()
export class RedisPubSubService { publish(topic: string, payload: unknown) { return { topic, payload, status: "queued" as const }; } }
