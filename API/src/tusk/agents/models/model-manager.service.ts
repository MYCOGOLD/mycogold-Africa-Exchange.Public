import { Injectable } from "@nestjs/common";
@Injectable()
export class ModelManagerService {
  activeModel() { return { name: "tusk-parser", version: "0.1", status: "approved" as const }; }
}
