import { Body, Controller, Post } from "@nestjs/common";

type TuskRequest = { message: string };

@Controller("tusk")
export class TuskController {
  @Post("parse-listing")
  parseListing(@Body() request: TuskRequest) {
    return {
      status: "accepted",
      message: request.message,
      next: "A production parser will extract product, quantity, unit, location, date, and price."
    };
  }
}
