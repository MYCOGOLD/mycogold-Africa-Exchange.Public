import { Injectable } from "@nestjs/common";
@Injectable()
export class WeatherService { forecast(location: string) { return { location, status: "adapter-not-configured" as const }; } }
