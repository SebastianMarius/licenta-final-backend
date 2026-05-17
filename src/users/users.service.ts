import { Injectable } from '@nestjs/common';
import { User } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class UsersService {
    constructor(private readonly prisma: PrismaService) { }

    async findByEmail(email: string): Promise<User | null> {
        return this.prisma.user.findUnique({ where: { email } });
    }

    async create(email: string, passwordHash: string): Promise<User> {
        return this.prisma.user.create({
            data: { email, passwordHash },
        });
    }

    async setPasswordResetToken(
        userId: number,
        tokenHash: string,
        expiresAt: Date,
    ): Promise<User> {
        return this.prisma.user.update({
            where: { id: userId },
            data: {
                passwordResetTokenHash: tokenHash,
                passwordResetExpires: expiresAt,
            },
        });
    }

    async findByValidResetTokenHash(tokenHash: string): Promise<User | null> {
        return this.prisma.user.findFirst({
            where: {
                passwordResetTokenHash: tokenHash,
                passwordResetExpires: { gt: new Date() },
            },
        });
    }

    async updatePasswordAndClearReset(
        userId: number,
        passwordHash: string,
    ): Promise<User> {
        return this.prisma.user.update({
            where: { id: userId },
            data: {
                passwordHash,
                passwordResetTokenHash: null,
                passwordResetExpires: null,
            },
        });
    }

    async saveApiKey(apiKey: string) {

    }
}
