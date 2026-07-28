import { Module } from '@nestjs/common';
import { DecoderService } from './decoder.service';

@Module({
  providers: [DecoderService],
  exports: [DecoderService],
})
export class DecoderModule {}
