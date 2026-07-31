import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { DecoderModule } from './decoders/decoder.module';
import { MqttModule } from './mqtt/mqtt.module';
import { TenantModule } from './modules/tenant/tenant.module';
import { SiteModule } from './modules/site/site.module';
import { ZoneModule } from './modules/zone/zone.module';
import { AssetModule } from './modules/asset/asset.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    DecoderModule,
    MqttModule,
    TenantModule,
    SiteModule,
    ZoneModule,
    AssetModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
