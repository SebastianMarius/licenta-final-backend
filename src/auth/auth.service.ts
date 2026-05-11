import {
    BadRequestException,
    ConflictException,
    Injectable,
    UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { MailService } from 'src/mail/mail.service';
import { UsersService } from 'src/users/users.service';

function normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
}

const RESET_TOKEN_TTL_MS = 15 * 60 * 1000;

@Injectable()
export class AuthService {
    constructor(
        private readonly usersService: UsersService,
        private jwtService: JwtService,
        private readonly mailService: MailService,
        private readonly config: ConfigService,
    ) {}

    async signUp(
        email: string,
        password: string,
    ): Promise<{ access_token: string }> {
        const normalized = normalizeEmail(email);
        if (!normalized || !password) {
            throw new BadRequestException();
        }
        const existing = await this.usersService.findByEmail(normalized);
        if (existing) {
            throw new ConflictException();
        }
        const passwordHash = await bcrypt.hash(password, 10);
        const user = await this.usersService.create(normalized, passwordHash);
        const payload = { sub: user.id, email: user.email };

        return {
            access_token: await this.jwtService.signAsync(payload),
        };
    }

    async signIn(email: string, pass: string): Promise<{ access_token: string }> {
        const normalized = normalizeEmail(email);
        const user = await this.usersService.findByEmail(normalized);
        if (!user || !(await bcrypt.compare(pass, user.passwordHash))) {
            throw new UnauthorizedException();
        }
        const payload = { sub: user.id, email: user.email };

        return {
            access_token: await this.jwtService.signAsync(payload),
        };
    }

    /**
     * Same response whether or not the email exists (avoid account enumeration).
     */
    async forgotPassword(emailRaw: string): Promise<{ message: string }> {
        const generic = {
            message:
                'If an account exists for this email, you will receive reset instructions shortly.',
        };

        const normalized = normalizeEmail(emailRaw);
        if (!normalized) {
            return generic;
        }

        const user = await this.usersService.findByEmail(normalized);
        if (!user) {
            return generic;
        }

        const token = crypto.randomBytes(32).toString('hex');
        const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
        const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);

        await this.usersService.setPasswordResetToken(
            user.id,
            tokenHash,
            expiresAt,
        );

        const baseUrl =
            this.config.get<string>('PASSWORD_RESET_FRONTEND_URL') ??
            this.config.get<string>('FRONTEND_URL') ??
            'http://localhost:3000';
        const resetLink = `${baseUrl.replace(/\/$/, '')}/reset-password?token=${token}`;

        await this.mailService.sendPasswordReset(user.email, resetLink);

        return generic;
    }

    async resetPassword(
        token: string,
        newPassword: string,
    ): Promise<{ message: string }> {
        if (!token?.trim() || !newPassword) {
            throw new BadRequestException('Token and password are required');
        }

        const tokenHash = crypto
            .createHash('sha256')
            .update(token.trim())
            .digest('hex');

        const user = await this.usersService.findByValidResetTokenHash(tokenHash);
        if (!user) {
            throw new BadRequestException('Invalid or expired reset token');
        }

        const passwordHash = await bcrypt.hash(newPassword, 10);
        await this.usersService.updatePasswordAndClearReset(user.id, passwordHash);

        return { message: 'Password has been reset. You can sign in now.' };
    }
}
