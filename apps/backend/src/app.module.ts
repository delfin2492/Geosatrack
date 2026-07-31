import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { DecoderModule } from './decoders/decoder.module';
import { MqttModule } from './mqtt/mqtt.module';
import { WebsocketModule } from './modules/websocket/websocket.module';
import { TenantModule } from './modules/tenant/tenant.module';
import { SiteModule } from './modules/site/site.module';
import { ZoneModule } from './modules/zone/zone.module';
import { AssetModule } from './modules/asset/asset.module';
import {
  KeycloakConnectModule,
  TokenValidation,
} from 'nest-keycloak-connect';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    KeycloakConnectModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        authServerUrl: config.get<string>('KEYCLOAK_URL') || 'http://localhost:8080',
        realm: config.get<string>('KEYCLOAK_REALM') || 'geomesh',
        clientId: config.get<string>('KEYCLOAK_CLIENT_ID') || 'geomesh-app',
        secret: config.get<string>('KEYCLOAK_CLIENT_SECRET') || 'change-me-on-production',
        tokenValidation: TokenValidation.OFFLINE,
      }),
    }),
    PrismaModule,
    DecoderModule,
    MqttModule,
    WebsocketModule,
    TenantModule,
    SiteModule,
    ZoneModule,
    AssetModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
