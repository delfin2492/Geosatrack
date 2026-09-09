import { Module } from '@nestjs/common';
import { AssetService } from './asset.service';
import { AssetController } from './asset.controller';
import { WebsocketModule } from '../websocket/websocket.module';
import { MqttModule } from '../../mqtt/mqtt.module';

@Module({
  imports: [WebsocketModule, MqttModule],
  controllers: [AssetController],
  providers: [AssetService],
  exports: [AssetService],
})
export class AssetModule {}
