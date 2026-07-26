import { GlobalSettings } from "../../data/postgres/models/global-settings.model";
import { encriptAdapter, envs } from "../../config";
import { CustomError } from "../../domain/errors/custom.error";
import { EmailService } from "./email.service";

export class SecurityService {
  private emailService: EmailService;

  constructor() {
    this.emailService = new EmailService(
      envs.MAILER_SERVICE,
      envs.MAILER_EMAIL,
      envs.MAILER_SECRET_KEY,
      envs.SEND_EMAIL
    );
  }

  /**
   * Valida el PIN Maestro. Si es incorrecto, envía alerta de seguridad al Admin y lanza CustomError.
   */
  async verifyMasterPin(
    pin: string,
    context: { action: string; details?: string }
  ): Promise<boolean> {
    const cleanPin = String(pin).trim();
    if (!cleanPin) {
      throw CustomError.unAuthorized("El PIN maestro es requerido");
    }

    const settings = await GlobalSettings.findOne({
      where: {},
      order: { updatedAt: "DESC" },
    });

    if (!settings || !settings.masterPin) {
      throw CustomError.unAuthorized("El sistema no tiene un PIN Maestro configurado.");
    }

    const isValid = encriptAdapter.compare(cleanPin, settings.masterPin);

    if (!isValid) {
      // PIN Incorrecto -> Lanzar alerta de seguridad silenciosamente
      await this.sendSecurityAlert(context);
      throw CustomError.unAuthorized("PIN Maestro incorrecto");
    }

    return true;
  }

  private async sendSecurityAlert(context: { action: string; details?: string }) {
    try {
      const { action, details } = context;
      const htmlBody = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
          <div style="background-color: #ef4444; color: white; padding: 20px; text-align: center;">
            <h1 style="margin: 0; font-size: 24px; letter-spacing: 2px; text-transform: uppercase;">⚠️ Alerta de Seguridad Crítica</h1>
          </div>
          <div style="padding: 30px; background-color: #f8fafc;">
            <p style="font-size: 16px; color: #334155; line-height: 1.5; margin-bottom: 20px;">
              Se ha detectado un intento fallido de acceso administrativo utilizando un <strong>PIN Maestro incorrecto</strong> en el sistema Atucucho Shop.
            </p>
            
            <div style="background-color: white; border-left: 4px solid #ef4444; padding: 15px; margin-bottom: 25px; border-radius: 0 4px 4px 0;">
              <h3 style="margin-top: 0; color: #1e293b; font-size: 14px; text-transform: uppercase; letter-spacing: 1px;">Detalles del Incidente</h3>
              <ul style="list-style: none; padding: 0; margin: 0; color: #475569; font-size: 15px;">
                <li style="margin-bottom: 8px;"><strong>Acción Intentada:</strong> <span style="color: #ef4444; font-weight: bold;">${action}</span></li>
                <li style="margin-bottom: 8px;"><strong>Fecha y Hora:</strong> ${new Date().toLocaleString("es-EC", { timeZone: "America/Guayaquil" })}</li>
                ${details ? `<li style="margin-bottom: 8px;"><strong>Detalles Adicionales:</strong> ${details}</li>` : ""}
              </ul>
            </div>

            <p style="font-size: 14px; color: #64748b; font-style: italic; border-top: 1px solid #e2e8f0; padding-top: 20px;">
              Si este no fuiste tú, alguien podría estar intentando vulnerar la seguridad administrativa. Te recomendamos considerar un cambio de PIN Maestro desde la sección de Ajustes Globales.
            </p>
          </div>
        </div>
      `;

      await this.emailService.sendEmail({
        to: envs.MAILER_EMAIL, // Enviar alerta al propio correo configurado como ADMIN/MAILER
        subject: `⚠️ ALERTA DE SEGURIDAD: Intento Fallido de PIN Maestro - ${action}`,
        htmlBody,
      });
      console.log(`[SECURITY] Alerta de correo enviada por fallo de PIN Maestro en acción: ${action}`);
    } catch (error) {
      console.error("[SECURITY] Fallo al enviar alerta de seguridad por correo", error);
    }
  }
}
