"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UseradminService = void 0;
const config_1 = require("../../../config");
const data_1 = require("../../../data");
const domain_1 = require("../../../domain");
const email_service_1 = require("../email.service");
class UseradminService {
    constructor() {
        this.emailService = new email_service_1.EmailService(config_1.envs.MAILER_SERVICE, config_1.envs.MAILER_EMAIL, config_1.envs.MAILER_SECRET_KEY, config_1.envs.SEND_EMAIL);
    }
    createUseradmin(useradminData) {
        return __awaiter(this, void 0, void 0, function* () {
            const useradmin = new data_1.Useradmin();
            useradmin.username = useradminData.username.toLocaleLowerCase().trim();
            useradmin.name = useradminData.name.toLocaleLowerCase().trim();
            useradmin.surname = useradminData.surname.toLocaleLowerCase().trim();
            useradmin.email = useradminData.email.toLocaleLowerCase().trim();
            useradmin.password = useradminData.password;
            useradmin.whatsapp = useradminData.whatsapp.trim();
            useradmin.rol = useradminData.rol;
            try {
                const newUseradmin = yield useradmin.save();
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
            }
            catch (error) {
                if (error.code === "23505") {
                    throw domain_1.CustomError.badRequest(`Correo:${useradminData.email} o Whatsapp:${useradminData.whatsapp} ya existen`);
                }
                throw domain_1.CustomError.internalServer(`Error al crear usuario: ${error.message}`);
            }
        });
    }
    loginAdmin(credentials) {
        return __awaiter(this, void 0, void 0, function* () {
            //buscar el usuario
            const useradmin = yield this.findUserByUsername(credentials.username);
            //validar la contraseña
            const isMatching = config_1.encriptAdapter.compare(credentials.password, useradmin.password);
            if (!isMatching)
                throw domain_1.CustomError.unAuthorized("Usuario o contraseña invalidos");
            //generar un jwt
            const tokenadmin = yield config_1.JwtAdapterAdmin.generateTokenAdmin({
                id: useradmin.id,
                role: "ADMIN"
            }, config_1.envs.JWT_EXPIRE_IN);
            const refreshToken = yield config_1.JwtAdapterAdmin.generateTokenAdmin({
                id: useradmin.id,
                role: "ADMIN"
            }, config_1.envs.JWT_REFRESH_EXPIRE_IN);
            if (!tokenadmin || !refreshToken)
                throw domain_1.CustomError.internalServer("Error generando Jwt");
            return {
                tokenadmin: tokenadmin,
                refreshToken: refreshToken,
                useradmin: {
                    id: useradmin.id,
                    name: useradmin.name,
                    surname: useradmin.surname,
                    username: useradmin.username,
                },
            };
        });
    }
    findUserByUsername(username) {
        return __awaiter(this, void 0, void 0, function* () {
            const useradmin = yield data_1.Useradmin.findOne({
                where: {
                    username: username,
                    status: data_1.Statusadmin.ACTIVE,
                },
            });
            if (!useradmin) {
                throw domain_1.CustomError.notFound(`Usuario: ${username} o contraseña no validos`);
            }
            return useradmin;
        });
    }
    forgotPassword(dto) {
        return __awaiter(this, void 0, void 0, function* () {
            const user = yield data_1.Useradmin.findOne({ where: { email: dto.email } });
            if (!user) {
                return {
                    message: "Si el usuario existe, se ha enviado un enlace de recuperación",
                };
            }
            const token = yield config_1.JwtAdapterAdmin.generateTokenAdmin({
                id: user.id,
                resetTokenVersion: user.resetTokenVersion,
            }, "5m");
            if (!token)
                throw domain_1.CustomError.internalServer("Error generando token");
            const recoveryLink = `${config_1.envs.WEBSERVICE_URL_FRONT}/admin/restablecer?token=${token}`;
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
            const sent = yield this.emailService.sendEmail({
                to: user.email,
                subject: "Recuperación de contraseña - Administrador",
                htmlBody: html,
            });
            if (!sent)
                throw domain_1.CustomError.internalServer("No se pudo enviar el correo de recuperación");
            return {
                message: "Si el usuario existe, se ha enviado un enlace de recuperación",
            };
        });
    }
    resetPassword(dto) {
        return __awaiter(this, void 0, void 0, function* () {
            const payload = yield config_1.JwtAdapterAdmin.validateTokenAdmin(dto.token);
            if (!payload || !payload.id || payload.resetTokenVersion === undefined) {
                throw domain_1.CustomError.unAuthorized("Token inválido o expirado");
            }
            const user = yield data_1.Useradmin.findOne({ where: { id: payload.id } });
            if (!user)
                throw domain_1.CustomError.notFound("Usuario no encontrado");
            // Comparar versión del token con la del usuario
            if (user.resetTokenVersion !== payload.resetTokenVersion) {
                throw domain_1.CustomError.unAuthorized("Este enlace ya fue usado o es inválido");
            }
            // Actualizar contraseña y aumentar versión
            user.password = config_1.encriptAdapter.hash(dto.newPassword);
            user.resetTokenVersion += 1;
            yield user.save();
            return { message: "Contraseña actualizada correctamente" };
        });
    }
    findAllUsersadmin() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const usersadmin = yield data_1.Useradmin.find();
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
            }
            catch (error) {
                throw domain_1.CustomError.internalServer("Error obteniendo usuarios administradores");
            }
        });
    }
    updatePassword(userId, data) {
        return __awaiter(this, void 0, void 0, function* () {
            const user = yield data_1.Useradmin.findOne({ where: { id: userId } });
            if (!user)
                throw domain_1.CustomError.notFound("Usuario no encontrado");
            const match = config_1.encriptAdapter.compare(data.currentPassword, user.password);
            if (!match)
                throw domain_1.CustomError.badRequest("La contraseña actual es incorrecta");
            user.password = config_1.encriptAdapter.hash(data.newPassword);
            yield user.save();
            const html = `
      <h3>Hola ${user.name},</h3>
      <p>Te informamos que tu contraseña ha sido modificada exitosamente.</p>
      <p>Si no fuiste tú, contacta soporte inmediatamente.</p>
    `;
            yield this.emailService.sendEmail({
                to: user.email,
                subject: "Seguridad - Cambio de Contraseña",
                htmlBody: html
            });
            return { message: "Contraseña actualizada correctamente" };
        });
    }
    updateSecurityPin(userId, pin) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!pin || pin.length < 4)
                throw domain_1.CustomError.badRequest("El PIN debe tener al menos 4 caracteres");
            // Buscar o Crear Configuración Global
            let settings = yield data_1.GlobalSettings.findOne({ where: {}, order: { updatedAt: "DESC" } });
            if (!settings) {
                settings = new data_1.GlobalSettings();
            }
            settings.masterPin = config_1.encriptAdapter.hash(pin);
            yield settings.save();
            return { message: "PIN Maestro Global actualizado correctamente" };
        });
    }
    validateMasterPin(pin, adminId) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!pin)
                throw domain_1.CustomError.badRequest("PIN es requerido");
            const cleanPin = String(pin).trim();
            // 1. Validar EXCLUSIVAMENTE contra GlobalSettings
            const settings = yield data_1.GlobalSettings.findOne({ where: {}, order: { updatedAt: "DESC" } });
            if (!settings || !settings.masterPin) {
                throw domain_1.CustomError.badRequest("El sistema no tiene un PIN Maestro configurado. Por favor configure su 'PIN de Seguridad' en su perfil de administrador.");
            }
            const isValid = config_1.encriptAdapter.compare(cleanPin, settings.masterPin);
            if (!isValid) {
                throw domain_1.CustomError.badRequest("PIN Maestro Incorrecto");
            }
            return { valid: true };
        });
    }
}
exports.UseradminService = UseradminService;
