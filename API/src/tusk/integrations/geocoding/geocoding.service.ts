import { Injectable } from "@nestjs/common";
@Injectable()
export class GeocodingService { locate(place: string) { return { place, status: "adapter-not-configured" as const }; } }
