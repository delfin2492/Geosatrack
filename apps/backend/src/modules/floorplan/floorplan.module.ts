import { Module } from '@nestjs/common';
import { FloorplanController } from './floorplan.controller';
import { FloorplanService } from './floorplan.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { RuleModule } from '../rule/rule.module';

@Module({
  imports: [PrismaModule, RuleModule],
  controllers: [FloorplanController],
  providers: [FloorplanService],
  exports: [FloorplanService],
})
export class FloorplanModule {}
