import {
    BadRequestException,
    ConflictException,
    Injectable,
    UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from 'src/users/users.service';

@Injectable()
export class AuthService {
    constructor(
        private readonly usersService: UsersService,
        private jwtService: JwtService,
    ) {}

    async signUp(
        username: string,
        password: string,
    ): Promise<{ access_token: string }> {
        if (!username?.trim() || !password) {
            throw new BadRequestException();
        }
        const existing = await this.usersService.findOne(username);
        if (existing) {
            throw new ConflictException();
        }
        const passwordHash = await bcrypt.hash(password, 10);
        const user = await this.usersService.create(username, passwordHash);
        const payload = { sub: user.id, username: user.username };

        return {
            access_token: await this.jwtService.signAsync(payload),
        };
    }

    async signIn(username: string, pass: string): Promise<{ access_token: string }> {
        const user = await this.usersService.findOne(username);
        if (!user || !(await bcrypt.compare(pass, user.passwordHash))) {
            throw new UnauthorizedException();
        }
        const payload = { sub: user.id, username: user.username };

        return {
            access_token: await this.jwtService.signAsync(payload),
        };
    }
}
