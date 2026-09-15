export class ValidationError extends Error {
  constructor(message: string, readonly field?: string) { super(message); this.name = "ValidationError"; }
}
