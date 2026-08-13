import { Controller, Get, Post, Body } from '@nestjs/common';
import { SystemSettingService } from './system-setting.service';

@Controller('system-settings')
export class SystemSettingController {
  constructor(private readonly systemSettingService: SystemSettingService) {}

  @Get()
  async getSettings() {
    return this.systemSettingService.getAllSettings();
  }

  @Post()
  async updateSettings(@Body() body: Record<string, string>) {
    return this.systemSettingService.setSettings(body);
  }
}
