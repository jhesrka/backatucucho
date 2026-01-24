import { encriptAdapter, envs, JwtAdapterAdmin } from "../../../config";
import { Statusadmin, Useradmin, GlobalSettings } from "../../../data";
import {
  CreateUseradminDTO,
  CustomError,
  ForgotPasswordDTO,
  LoginAdminUserDTO,
  ResetPasswordDTO,
} from "../../../domain";
import { EmailService } from "../email.service";

export class UseradminService {
  private emailService: EmailService;

  constructor() {
    this.emailService = new EmailService(
      envs.MAILER_SERVICE,
      envs.MAILER_EMAIL,
      envs.MAILER_SECRET_KEY,
      envs.SEND_EMAIL
    );
  }

  async createUseradmin(useradminData: CreateUseradminDTO) {
    const useradmin = new Useradmin();
    useradmin.username = useradminData.username.toLocaleLowerCase().trim();
    useradmin.name = useradminData.name.toLocaleLowerCase().trim();
    useradmin.surname = useradminData.surname.toLocaleLowerCase().trim();
    useradmin.email = useradminData.email.toLocaleLowerCase().trim();
    useradmin.password = useradminData.password;
    useradmin.whatsapp = useradminData.whatsapp.trim();
    useradmin.rol = useradminData.rol;

    try {
      const newUseradmin = await useradmin.save();
      return {
        id: newUseradmin.id,
        username: newUseradmin.username,
        name: newUseradmin.name,
        surname: newUseradmin.surname,
        email: newUseradmin.email,
        whatsapp: newUseradmin.whatsapp,
        create_at: newUseradmin.created_at,
        update_at: newUseradmin.updated_at,
        rol: newUseradmin.rol,
        status: newUseradmin.status,
      };
    } catch (error: any) {
      if (error.code === "23505") {
        throw CustomError.badRequest(
          `Correo:${useradminData.email} o Whatsapp:${useradminData.whatsapp} ya existen`
        );
      }
      throw CustomError.internalServer(
        `Error al crear usuario: ${error.message}`
      );
    }
  }
  async loginAdmin(credentials: LoginAdminUserDTO) {
    //buscar el usuario
    const useradmin = await this.findUserByUsername(credentials.username);
    //validar la contraseña
    const isMatching = encriptAdapter.compare(
      credentials.password,
      useradmin.password
    );
    if (!isMatching)
      throw CustomError.unAuthorized("Usuario o contraseña invalidos");
    //generar un jwt
    const tokenadmin = await JwtAdapterAdmin.generateTokenAdmin(
      {
        id: useradmin.id,
      },
      envs.JWT_EXPIRE_IN
    );

    if (!tokenadmin) throw CustomError.internalServer("Error generando Jwt");

    return {
      tokenadmin: tokenadmin,
      useradmin: {
        id: useradmin.id,
        name: useradmin.name,
        surname: useradmin.surname,
        username: useradmin.username,
      },
    };
  }
  async findUserByUsername(username: string) {
    const useradmin = await Useradmin.findOne({
      where: {
        username: username,
        status: Statusadmin.ACTIVE,
      },
    });
    if (!useradmin) {
      throw CustomError.notFound(
        `Usuario: ${username} o contraseña no validos`
      );
    }
    return useradmin;
  }

  async forgotPassword(dto: ForgotPasswordDTO) {
    const user = await Useradmin.findOne({ where: { email: dto.email } });

    if (!user) {
      return {
        message:
          "Si el usuario existe, se ha enviado un enlace de recuperación",
      };
    }

    const token = await JwtAdapterAdmin.generateTokenAdmin(
      {
        id: user.id,
        resetTokenVersion: user.resetTokenVersion,
      },
      "5m"
    );


    if (!token) throw CustomError.internalServer("Error generando token");

    const recoveryLink = `${envs.WEBSERVICE_URL_FRONT}/admin/restablecer?token=${token}`;

    const html = `
  <html>
    <body style="font-family: Arial, sans-serif; color: #333;">
      <h3>Hola ${user.name} ${user.surname},</h3>
      <p>Has solicitado restablecer tu contraseña. Haz clic en el siguiente botón para continuar:</p>
      <p>
        <a href="${recoveryLink}"
           style="display: inline-block; background-color: #4CAF50; color: white; padding: 10px 15px; text-decoration: none; border-radius: 5px;">
          Restablecer contraseña
        </a>
      </p>
      <p>Este enlace expirará en 5 minutos.</p>
      <br />
      <p style="font-size: 0.9em; color: #888;">Si no solicitaste este cambio, puedes ignorar este correo.</p>
    </body>
  </html>
`;

    const sent = await this.emailService.sendEmail({
      to: user.email,
      subject: "Recuperación de contraseña - Administrador",
      htmlBody: html,
    });

    if (!sent)
      throw CustomError.internalServer(
        "No se pudo enviar el correo de recuperación"
      );

    return {
      message: "Si el usuario existe, se ha enviado un enlace de recuperación",
    };
  }

  async resetPassword(dto: ResetPasswordDTO) {
    const payload: any = await JwtAdapterAdmin.validateTokenAdmin(dto.token);

    if (!payload || !payload.id || payload.resetTokenVersion === undefined) {
      throw CustomError.unAuthorized("Token inválido o expirado");
    }

    const user = await Useradmin.findOne({ where: { id: payload.id } });

    if (!user) throw CustomError.notFound("Usuario no encontrado");

    // Comparar versión del token con la del usuario
    if (user.resetTokenVersion !== payload.resetTokenVersion) {
      throw CustomError.unAuthorized("Este enlace ya fue usado o es inválido");
    }

    // Actualizar contraseña y aumentar versión
    user.password = encriptAdapter.hash(dto.newPassword);
    user.resetTokenVersion += 1;

    await user.save();

    return { message: "Contraseña actualizada correctamente" };
  }


  async findAllUsersadmin() {
    try {
      const usersadmin = await Useradmin.find();
      return usersadmin.map((useradmin) => ({
        id: useradmin.id,
        username: useradmin.username,
        name: useradmin.name,
        surname: useradmin.surname,
        email: useradmin.email,
        whatsapp: useradmin.whatsapp,
        created_at: useradmin.created_at,
        update_at: useradmin.updated_at,
        rol: useradmin.rol,
        status: useradmin.status,
      }));
    } catch (error) {
      throw CustomError.internalServer(
        "Error obteniendo usuarios administradores"
      );
    }
  }
  async updatePassword(userId: string, data: { currentPassword: string; newPassword: string }) {
    const user = await Useradmin.findOne({ where: { id: userId } });
    if (!user) throw CustomError.notFound("Usuario no encontrado");

    const match = encriptAdapter.compare(data.currentPassword, user.password);
    if (!match) throw CustomError.badRequest("La contraseña actual es incorrecta");

    user.password = encriptAdapter.hash(data.newPassword);
    await user.save();

    const html = `
      <h3>Hola ${user.name},</h3>
      <p>Te informamos que tu contraseña ha sido modificada exitosamente.</p>
      <p>Si no fuiste tú, contacta soporte inmediatamente.</p>
    `;

    await this.emailService.sendEmail({
      to: user.email,
      subject: "Seguridad - Cambio de Contraseña",
      htmlBody: html
    });

    return { message: "Contraseña actualizada correctamente" };
  }

  async updateSecurityPin(userId: string, pin: string) {
    if (!pin || pin.length < 4) throw CustomError.badRequest("El PIN debe tener al menos 4 caracteres");

    // Buscar o Crear Configuración Global
    let settings = await GlobalSettings.findOne({ where: {}, order: { updatedAt: "DESC" } });
    if (!settings) {
      settings = new GlobalSettings();
    }

    settings.masterPin = encriptAdapter.hash(pin);
    await settings.save();

    return { message: "PIN Maestro Global actualizado correctamente" };
  }

  async validateMasterPin(pin: string, adminId?: string) {
    if (!pin) throw CustomError.badRequest("PIN es requerido");

    const cleanPin = String(pin).trim();

    // 1. Validar EXCLUSIVAMENTE contra GlobalSettings
    const settings = await GlobalSettings.findOne({ where: {}, order: { updatedAt: "DESC" } });

    if (!settings || !settings.masterPin) {
      throw CustomError.badRequest("El sistema no tiene un PIN Maestro configurado. Por favor configure su 'PIN de Seguridad' en su perfil de administrador.");
    }

    const isValid = encriptAdapter.compare(cleanPin, settings.masterPin);

    if (!isValid) {
      throw CustomError.badRequest("PIN Maestro Incorrecto");
    }

    return { valid: true };
  }
}
