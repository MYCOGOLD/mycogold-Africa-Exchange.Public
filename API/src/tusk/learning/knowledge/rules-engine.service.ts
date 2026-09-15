import { Injectable } from "@nestjs/common";
@Injectable()
export class RulesEngineService { check(rule: string) { return { rule, allowed: false, status: "requires-policy-definition" as const }; } }
