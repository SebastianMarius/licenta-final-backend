import {
    BadRequestException,
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

    @HttpCode(HttpStatus.OK)
    @Post('forgot-password')
    forgotPassword(@Body() body: { email?: string }) {
        const email = body.email?.trim();
        if (!email) {
            throw new BadRequestException('Email is required');
        }
        return this.authService.forgotPassword(email);
    }

    @HttpCode(HttpStatus.OK)
    @Post('reset-password')
    resetPassword(@Body() body: { token?: string; password?: string }) {
        return this.authService.resetPassword(
            body.token ?? '',
            body.password ?? '',
        );
    }

    @UseGuards(AuthGuard)
    @Get('profile')
    getProfile(@Request() req) {
        return req.user;
    }
}
