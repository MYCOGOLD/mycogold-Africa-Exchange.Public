import { Injectable } from "@nestjs/common";
@Injectable()
export class WorkerPoolProcessor {
  enqueue(job: string) { return { job, status: "queued" as const }; }
}
