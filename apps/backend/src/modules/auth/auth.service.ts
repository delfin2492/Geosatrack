import { Injectable, NotFoundException, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  async login(email: string, password?: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            logoUrl: true,
            adminEmail: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException(`Akun dengan email "${email}" tidak ditemukan.`);
    }

    if (!user.isVerified) {
      throw new UnauthorizedException('Akun Anda belum terverifikasi. Harap hubungi Administrator.');
    }

    // Verify password (in dev/demo mode or exact match)
    if (password && user.password && user.password !== password) {
      throw new UnauthorizedException('Kata sandi yang Anda masukkan salah.');
    }

    return {
      message: 'Login berhasil',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        isVerified: user.isVerified,
        tenantId: user.tenantId,
      },
      tenant: user.tenant,
    };
  }

  async changePassword(email: string, oldPassword?: string, newPassword?: string) {
    if (!newPassword || newPassword.trim().length < 6) {
      throw new BadRequestException('Password baru minimal 6 karakter.');
    }

    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new NotFoundException(`Akun dengan email "${email}" tidak ditemukan.`);
    }

    // Verify old password if user has one stored
    if (user.password && oldPassword && user.password !== oldPassword) {
      throw new UnauthorizedException('Password lama tidak sesuai.');
    }

    await this.prisma.user.update({
      where: { email },
      data: { password: newPassword },
    });

    return { message: 'Password berhasil diubah.' };
  }
}
