import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class SystemSettingService {
  private readonly logger = new Logger(SystemSettingService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getAllSettings() {
    const settings = await this.prisma.systemSetting.findMany();
    // Convert array of {key, value} to an object
    const settingsObj: Record<string, string> = {};
    for (const setting of settings) {
      settingsObj[setting.key] = setting.value;
    }
    return settingsObj;
  }

  async getSetting(key: string) {
    const setting = await this.prisma.systemSetting.findUnique({
      where: { key },
    });
    return setting?.value;
  }

  async setSettings(settings: Record<string, string>) {
    this.logger.log('Updating system settings');
    const updatePromises = [];
    for (const [key, value] of Object.entries(settings)) {
      updatePromises.push(
        this.prisma.systemSetting.upsert({
          where: { key },
          update: { value },
          create: { key, value },
        })
      );
    }
    await Promise.all(updatePromises);
    return this.getAllSettings();
  }
}
