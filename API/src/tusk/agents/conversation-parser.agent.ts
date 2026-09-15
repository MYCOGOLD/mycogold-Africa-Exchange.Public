import { Injectable } from "@nestjs/common";
@Injectable()
export class ConversationParserAgent {
  parse(message: string) { return { message, fields: {}, requiresConfirmation: true as const }; }
}
