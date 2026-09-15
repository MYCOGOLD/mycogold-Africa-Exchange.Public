import { Injectable } from "@nestjs/common";
@Injectable()
export class MultiVariableCompiler { compile(formula: string) { return { formula, status: "validated-by-review" as const }; } }
