import { Injectable, InternalServerErrorException } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private readonly transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 465),
    secure: true,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  async sendRecoveryCode(
    destinationEmail: string,
    code: string,
  ): Promise<void> {
    try {
      await this.transporter.sendMail({
        from: process.env.SMTP_FROM,
        to: destinationEmail,
        subject: 'Sistema007 - Recuperación de contraseña',
        text: [
          'Has solicitado recuperar tu contraseña de Sistema007.',
          '',
          `Tu código de verificación es: ${code}`,
          '',
          'Este código vence en 10 minutos.',
          'Si no solicitaste este cambio, ignora este correo.',
        ].join('\n'),
      });
    } catch {
      throw new InternalServerErrorException(
        'No fue posible enviar el correo de recuperación.',
      );
    }
  }
}
