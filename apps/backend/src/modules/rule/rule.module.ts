import { Module } from '@nestjs/common';
import { RuleService } from './rule.service';
import { RuleController } from './rule.controller';
import { RulesEngineService } from './rules-engine.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [RuleController],
  providers: [RuleService, RulesEngineService],
  exports: [RuleService, RulesEngineService],
})
export class RuleModule {}
