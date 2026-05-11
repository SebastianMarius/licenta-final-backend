import {
    Injectable,
    InternalServerErrorException,
    Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

@Injectable()
export class MailService {
    private readonly logger = new Logger(MailService.name);
    private readonly resend: Resend | null;

    constructor(private readonly config: ConfigService) {
        const apiKey = this.config.get<string>('RESEND_API_KEY');
        this.resend = apiKey ? new Resend(apiKey) : null;
        if (!apiKey) {
            this.logger.warn(
                'RESEND_API_KEY is not set — password reset emails will be logged only.',
            );
        }
    }

    async sendPasswordReset(to: string, resetLink: string): Promise<void> {
        const subject = 'Reset your password';
        const html = `
            <p>You requested a password reset.</p>
            <p><a href="${resetLink}">Click here to set a new password</a></p>
            <p>This link expires in 15 minutes.</p>
        `;

        if (!this.resend) {
            this.logger.warn(
                `[Resend not configured] Password reset for ${to}: ${resetLink}`,
            );
            return;
        }

        const from =
            this.config.get<string>('RESEND_FROM') ??
            'Rental <onboarding@resend.dev>';

        const { error } = await this.resend.emails.send({
            from,
            to: [to],
            subject,
            html,
        });

        if (error) {
            this.logger.error(
                `Resend send failed: ${error.name} — ${error.message}`,
            );
            throw new InternalServerErrorException(
                'Could not send password reset email',
            );
        }
    }
}
