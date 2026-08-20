import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async getSections(tenantId: string) {
    return this.prisma.dashboardSection.findMany({
      where: { tenantId },
      orderBy: { order: 'asc' },
      include: { widgets: true },
    });
  }

  async createSection(tenantId: string, name: string) {
    const count = await this.prisma.dashboardSection.count({ where: { tenantId } });
    return this.prisma.dashboardSection.create({
      data: {
        name,
        order: count,
        tenantId,
      },
      include: { widgets: true },
    });
  }

  async updateSection(id: string, tenantId: string, data: { name?: string; order?: number }) {
    return this.prisma.dashboardSection.update({
      where: { id, tenantId },
      data,
    });
  }

  async deleteSection(id: string, tenantId: string) {
    return this.prisma.dashboardSection.delete({
      where: { id, tenantId },
    });
  }

  async saveSectionLayout(id: string, tenantId: string, layoutStr: string, widgetsData: any[]) {
    await this.prisma.dashboardSection.update({
      where: { id, tenantId },
      data: { layout: layoutStr },
    });

    const widgetIds = widgetsData.map((w: any) => w.id).filter((id: string) => id);

    await this.prisma.dashboardWidget.deleteMany({
      where: {
        sectionId: id,
        id: { notIn: widgetIds }
      }
    });

    for (const w of widgetsData) {
      const existing = await this.prisma.dashboardWidget.findUnique({ where: { id: w.id } });
      const configStr = typeof w.config === 'string' ? w.config : JSON.stringify(w.config || {});
      
      if (!existing) {
        await this.prisma.dashboardWidget.create({
          data: {
            id: w.id,
            sectionId: id,
            type: w.type,
            config: configStr,
          }
        });
      } else {
        await this.prisma.dashboardWidget.update({
          where: { id: w.id },
          data: {
            config: configStr,
          }
        });
      }
    }

    return { success: true };
  }
}
