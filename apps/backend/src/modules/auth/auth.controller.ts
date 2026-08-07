import { Controller, Post, Body } from '@nestjs/common';
import { AuthService } from './auth.service';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  login(@Body() body: { email: string; password?: string }) {
    return this.authService.login(body.email, body.password);
  }

  @Post('change-password')
  changePassword(
    @Body() body: { email: string; oldPassword?: string; newPassword: string },
  ) {
    return this.authService.changePassword(body.email, body.oldPassword, body.newPassword);
  }
}
