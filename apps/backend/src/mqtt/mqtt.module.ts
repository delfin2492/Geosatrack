import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MqttService } from './mqtt.service';
import { DecoderModule } from '../decoders/decoder.module';
import { FloorplanModule } from '../modules/floorplan/floorplan.module';
import { RuleModule } from '../modules/rule/rule.module';

@Module({
  imports: [ConfigModule, DecoderModule, FloorplanModule, RuleModule],
  providers: [MqttService],
  exports: [MqttService],
})
export class MqttModule {}
