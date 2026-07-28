import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MqttService } from './mqtt.service';
import { DecoderModule } from '../decoders/decoder.module';

@Module({
  imports: [ConfigModule, DecoderModule],
  providers: [MqttService],
  exports: [MqttService],
})
export class MqttModule {}
