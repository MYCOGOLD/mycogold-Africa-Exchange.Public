import { Injectable } from "@nestjs/common";
@Injectable()
export class CacheLayerService { get(key: string) { return { key, hit: false }; } }
