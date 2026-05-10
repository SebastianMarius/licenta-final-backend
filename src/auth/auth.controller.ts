import {
    Body,
    Controller,
    Get,
    HttpCode,
    HttpStatus,
    Post,
    Request,
    UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthGuard } from './auth.guard';

@Controller('auth')
export class AuthController {
    constructor(private readonly authService: AuthService) {}

    @HttpCode(HttpStatus.CREATED)
    @Post('signup')
    signUp(@Body() body: { email?: string; password?: string }) {
        return this.authService.signUp(body.email ?? '', body.password ?? '');
    }

    @HttpCode(HttpStatus.OK)
    @Post('login')
    signIn(@Body() body: { email?: string; password?: string }) {
        return this.authService.signIn(body.email ?? '', body.password ?? '');
    }

    @UseGuards(AuthGuard)
    @Get('profile')
    getProfile(@Request() req) {
        return req.user;
    }
}
