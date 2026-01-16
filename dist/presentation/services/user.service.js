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
exports.UserService = void 0;
// src/presentation/services/user.service.ts
const data_1 = require("../../data"); // Modelo de usuario
const domain_1 = require("../../domain"); // DTOs
const socket_1 = require("../../config/socket"); // Para emitir eventos a través de socket.io
const config_1 = require("../../config");
class UserService {
    constructor(emailService) {
        this.emailService = emailService;
        this.sendEmailValidationLink = (email) => __awaiter(this, void 0, void 0, function* () {
            const token = yield config_1.JwtAdapter.generateToken({ email }, "3000s");
            if (!token)
                throw domain_1.CustomError.internalServer("Error generando token para enviar email");
            const link = `http://${config_1.envs.WEBSERVICE_URL}/api/user/validate-email/${token}`;
            const html = `
  <div style="font-family: Arial, sans-serif; color: #333; max-width: 500px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 8px;">
    <div style="text-align: center; margin-bottom: 20px;">
      <img src="https://tusitio.com/logo-atucucho.png" alt="Atucucho Shop" style="max-width: 150px;" />
    </div>
    <h2 style="color: #2c3e50; text-align: center;">Activa tu cuenta en Atucucho Shop</h2>
    <p>Hola,</p>
    <p>Este correo ha sido enviado para que puedas <strong>activar tu cuenta en Atucucho Shop</strong>. Para continuar, por favor haz clic en el botón a continuación:</p>
    <div style="text-align: center; margin: 20px 0;">
      <a href="${link}" style="display: inline-block; padding: 12px 24px; background-color: #3498db; color: white; text-decoration: none; border-radius: 5px; font-weight: bold;">Activar cuenta</a>
    </div>
    <p><strong>Importante:</strong> este enlace es válido solo por <strong>5 minutos</strong>. Si expira, deberás solicitar uno nuevo.</p>
    <p>Si tú no solicitaste esta verificación, puedes ignorar este mensaje de forma segura.</p>
    <hr style="margin: 30px 0;" />
    <p style="font-size: 12px; color: #999; text-align: center;">Correo enviado a: ${email}</p>
    <p style="font-size: 12px; color: #999; text-align: center;">Gracias por unirte a Atucucho Shop.</p>
  </div>
`;
            const isSent = this.emailService.sendEmail({
                to: email,
                subject: "Validate your email",
                htmlBody: html,
            });
            if (!isSent)
                throw domain_1.CustomError.internalServer("Error enviando el correo");
            return true;
        });
        this.validateEmail = (token) => __awaiter(this, void 0, void 0, function* () {
            const payload = yield config_1.JwtAdapter.validateToken(token);
            if (!payload)
                throw domain_1.CustomError.badRequest("Token no validado");
            const { email } = payload;
            if (!email)
                throw domain_1.CustomError.internalServer("Email not in token");
            const user = yield data_1.User.findOne({ where: { email: email } });
            if (!user)
                throw domain_1.CustomError.internalServer("Correo no existe");
            user.status = data_1.Status.ACTIVE;
            try {
                yield user.save();
                return {
                    message: "activado",
                };
            }
            catch (error) {
                throw domain_1.CustomError.internalServer("Something went very wrong");
            }
        });
    }
    login(credentials) {
        return __awaiter(this, void 0, void 0, function* () {
            //buscar el usuario
            const user = yield this.findUserByEmail(credentials.email);
            //validar la contraseña
            const isMatching = config_1.encriptAdapter.compare(credentials.password, user.password);
            if (!isMatching)
                throw domain_1.CustomError.unAuthorized("Usuario o contraseña invalidos");
            //generar un jwt
            const token = yield config_1.JwtAdapter.generateToken({ id: user.id });
            if (!token)
                throw domain_1.CustomError.internalServer("Error generando Jwt");
            // enviar la data
            console.log(token, user);
            return {
                token: token,
                user: {
                    id: user.id,
                    name: user.name,
                },
            };
        });
    }
    findUserByEmail(email) {
        return __awaiter(this, void 0, void 0, function* () {
            const user = yield data_1.User.findOne({
                where: {
                    email: email,
                    status: data_1.Status.ACTIVE,
                },
            });
            if (!user) {
                throw domain_1.CustomError.notFound(`Usuario: ${email} no encontrado`);
            }
            return user;
        });
    }
    // Obtener todos los usuarios
    findAllUsers() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const users = yield data_1.User.find();
                // Filtrar manualmente los campos que deseas devolver
                return users.map((user) => ({
                    id: user.id,
                    name: user.name,
                    surname: user.surname,
                    email: user.email,
                    birthday: user.birthday,
                    whatsapp: user.whatsapp,
                    photoperfil: user.photoperfil,
                    created_at: user.created_at,
                    updated_at: user.updated_at,
                    rol: user.rol,
                    status: user.status,
                }));
            }
            catch (error) {
                throw domain_1.CustomError.internalServer("Error obteniendo los usuarios");
            }
        });
    }
    // Obtener un usuario por ID
    findOneUser(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            const result = yield data_1.User.findOne({
                where: { id: userId, status: data_1.Status.ACTIVE },
            });
            if (!result)
                throw domain_1.CustomError.notFound("Usuario no encontrado");
            return result;
        });
    }
    // Crear un nuevo usuario
    createUser(userData, file) {
        return __awaiter(this, void 0, void 0, function* () {
            // Encriptar la contraseña
            const user = new data_1.User();
            user.name = userData.name.toLowerCase().trim();
            user.surname = userData.surname.toLowerCase().trim();
            user.email = userData.email.toLowerCase().trim();
            user.password = userData.password;
            user.birthday = new Date(userData.birthday); // Convertir a tipo Date
            user.whatsapp = userData.whatsapp.trim();
            if ((file === null || file === void 0 ? void 0 : file.originalname) && file.originalname.length > 0) {
                //TODO:SUBIR ESTO A LA NUBE
            }
            try {
                const newUser = yield user.save();
                yield this.sendEmailValidationLink(newUser.email);
                (0, socket_1.getIO)().emit("userChanged", newUser); // Emitir evento
                return {
                    id: newUser.id,
                    name: newUser.name,
                    surname: newUser.surname,
                    email: newUser.email,
                    birthday: newUser.birthday.toISOString(),
                    whatsapp: newUser.whatsapp,
                    photoperfil: newUser.photoperfil,
                    create_at: newUser.created_at,
                    update_at: newUser.updated_at,
                    status: newUser.status,
                };
            }
            catch (error) {
                console.log(error);
                if (error.code === "23505") {
                    throw domain_1.CustomError.badRequest(`Correo:${userData.email} o Whatsapp:${userData.whatsapp} ya existen`);
                }
                throw domain_1.CustomError.internalServer("Error creando el Usuario");
            }
        });
    }
    // Actualizar datos del usuario
    updateUser(id, userData) {
        return __awaiter(this, void 0, void 0, function* () {
            const user = yield this.findOneUser(id);
            // Asignar los nuevos valores, solo los campos que se hayan proporcionado
            if (userData.name)
                user.name = userData.name.toLowerCase().trim();
            if (userData.surname)
                user.surname = userData.surname.toLowerCase().trim();
            if (userData.email)
                user.email = userData.email.toLowerCase().trim();
            if (userData.password)
                user.password = userData.password;
            if (userData.birthday)
                user.birthday = new Date(userData.birthday); // Convertir a tipo Date
            if (userData.whatsapp)
                user.whatsapp = userData.whatsapp.trim();
            if (userData.photoperfil)
                user.photoperfil = userData.photoperfil.trim();
            try {
                const updatedUser = yield user.save();
                (0, socket_1.getIO)().emit("userChanged", updatedUser); // Emitir evento
                return updatedUser;
            }
            catch (error) {
                throw domain_1.CustomError.internalServer("Error actualizando el Usuario");
            }
        });
    }
    // Eliminar un usuario (marcar como inactivo)
    deleteUser(id) {
        return __awaiter(this, void 0, void 0, function* () {
            const user = yield this.findOneUser(id);
            user.status = data_1.Status.DELETED; // Cambiar a estado inactivo
            try {
                yield user.save(); // Usamos `save` en vez de `remove` porque no estamos eliminando el registro, solo marcándolo
                (0, socket_1.getIO)().emit("userChanged", user); // Emitir evento
            }
            catch (error) {
                throw domain_1.CustomError.internalServer("Error eliminando el Usuario");
            }
        });
    }
    getUserProfile(user) {
        return __awaiter(this, void 0, void 0, function* () {
            return {
                id: user.id,
                name: user.name,
                surname: user.surname,
                email: user.email,
                photo: user.photoperfil,
            };
        });
    }
    blockAccount() {
        return __awaiter(this, void 0, void 0, function* () {
            return "hola";
        });
    }
}
exports.UserService = UserService;
