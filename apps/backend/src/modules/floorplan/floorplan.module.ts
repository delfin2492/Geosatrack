import { Module } from '@nestjs/common';
import { FloorplanController } from './floorplan.controller';
import { FloorplanService } from './floorplan.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [FloorplanController],
  providers: [FloorplanService],
  exports: [FloorplanService],
})
export class FloorplanModule {}
