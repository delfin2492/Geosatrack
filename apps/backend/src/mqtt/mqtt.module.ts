import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MqttService } from './mqtt.service';
import { DecoderModule } from '../decoders/decoder.module';
import { FloorplanModule } from '../modules/floorplan/floorplan.module';

@Module({
  imports: [ConfigModule, DecoderModule, FloorplanModule],
  providers: [MqttService],
  exports: [MqttService],
})
export class MqttModule {}
