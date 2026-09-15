import { Injectable, PipeTransform } from "@nestjs/common";
@Injectable()
export class StreamIngestPipe implements PipeTransform {
  transform(value: unknown) { return value; }
}
