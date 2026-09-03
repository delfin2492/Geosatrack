import { Controller, Get, Post, Body, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
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

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('File is required');
    
    const fs = await import('fs');
    const path = await import('path');
    
    const uploadDir = path.join(process.cwd(), 'uploads', 'system');
    fs.mkdirSync(uploadDir, { recursive: true });
    
    const ext = path.extname(file.originalname) || '.png';
    const filename = `brand-${Date.now()}${ext}`;
    
    fs.writeFileSync(path.join(uploadDir, filename), file.buffer);
    
    return { url: `/uploads/system/${filename}` };
  }
}
