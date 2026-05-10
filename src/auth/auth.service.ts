import {
    BadRequestException,
    ConflictException,
    Injectable,
    UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from 'src/users/users.service';

function normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
}

@Injectable()
export class AuthService {
    constructor(
        private readonly usersService: UsersService,
        private jwtService: JwtService,
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
}
