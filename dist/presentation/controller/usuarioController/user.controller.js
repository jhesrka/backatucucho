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
exports.UserController = void 0;
const domain_1 = require("../../../domain");
class UserController {
    constructor(userService) {
        this.userService = userService;
        this.handleError = (error, res) => {
            if (error instanceof domain_1.CustomError) {
                return res.status(error.statusCode).json({ message: error.message });
            }
            // Handle validation strings from DTOs
            if (typeof error === 'string') {
                return res.status(400).json({ message: error });
            }
            console.error("Unhandled error:", error);
            const message = error instanceof Error ? error.message : "Internal Server Error";
            return res.status(500).json({ message });
        };
        //USUARIO
        this.createUser = (req, res) => {
            const [error, createUserDto] = domain_1.CreateUserDTO.create(req.body);
            if (error)
                return this.handleError(error, res);
            this.userService
                .createUser(createUserDto, req.file)
                .then((data) => res.status(201).json(data))
                .catch((error) => this.handleError(error, res));
        };
        this.login = (req, res) => {
            // Extraer IP de headers o conexión
            const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
            const [error, loginUserDto] = domain_1.LoginUserDTO.create(Object.assign(Object.assign({}, req.body), { ip }));
            if (error)
                return res.status(422).json({ message: error });
            this.userService
                .login(loginUserDto)
                .then((data) => res.status(200).json(data))
                .catch((error) => this.handleError(error, res));
        };
        this.loginGoogle = (req, res) => {
            const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || "127.0.0.1";
            const [error, loginGoogleDto] = domain_1.LoginGoogleUserDTO.create(req.body);
            if (error)
                return res.status(422).json({ message: error });
            this.userService
                .loginWithGoogle(loginGoogleDto.token, ip)
                .then((data) => res.status(200).json(data))
                .catch((error) => this.handleError(error, res));
        };
        this.logout = (req, res) => {
            const userId = req.body.sessionUser.id;
            this.userService.logout(userId)
                .then((data) => res.status(200).json(data))
                .catch((error) => this.handleError(error, res));
        };
        this.forgotPassword = (req, res) => {
            const [error, dto] = domain_1.ForgotPasswordUserDTO.create(req.body);
            if (error)
                return res.status(400).json({ message: error });
            this.userService
                .forgotPassword(dto)
                .then((data) => res.status(200).json(data))
                .catch((err) => this.handleError(err, res));
        };
        this.resetPassword = (req, res) => {
            const [errors, dto] = domain_1.ResetPasswordUserDTO.create(req.body);
            if (errors.length > 0) {
                return res.status(400).json({ message: errors });
            }
            this.userService
                .resetPassword(dto)
                .then((data) => res.status(200).json(data))
                .catch((err) => this.handleError(err, res));
        };
        this.changePassword = (req, res) => {
            const userId = req.body.sessionUser.id;
            const [error, dto] = domain_1.ChangePasswordUserDTO.create(req.body);
            if (error)
                return res.status(400).json({ message: error });
            this.userService
                .changePassword(userId, dto)
                .then((data) => res.status(200).json(data))
                .catch((error) => this.handleError(error, res));
        };
        this.updateUser = (req, res) => __awaiter(this, void 0, void 0, function* () {
            const { id } = req.params;
            const [error, updateUserDto] = domain_1.UpdateUserDTO.create(req.body);
            if (error)
                return res.status(422).json({ message: error });
            try {
                const updatedUser = yield this.userService.updateUser(id, updateUserDto, req.file);
                return res.status(200).json(updatedUser);
            }
            catch (error) {
                return this.handleError(error, res);
            }
        });
        this.completeProfile = (req, res) => {
            const { whatsapp, password, acceptedTerms, acceptedPrivacy } = req.body;
            const userId = req.body.sessionUser.id;
            this.userService
                .completeProfile(userId, { whatsapp, password, acceptedTerms, acceptedPrivacy })
                .then((data) => res.status(200).json(data))
                .catch((error) => this.handleError(error, res));
        };
        this.findOneUser = (req, res) => {
            const { id } = req.params;
            this.userService
                .findOneUser(id)
                .then((data) => res.status(200).json(data))
                .catch((error) => this.handleError(error, res));
        };
        this.deleteUser = (req, res) => {
            const { id } = req.params;
            this.userService
                .deleteUser(id)
                .then(() => res.status(204).json(null))
                .catch((error) => this.handleError(error, res));
        };
        this.getFullProfile = (req, res) => {
            this.userService
                .getFullProfile(req.body.sessionUser)
                .then((data) => res.status(200).json(data))
                .catch((error) => this.handleError(error, res));
        };
        this.getLoggedUserInfo = (req, res) => {
            this.userService
                .getProfileUserLogged(req.body.sessionUser)
                .then((data) => res.status(200).json(data))
                .catch((error) => this.handleError(error, res));
        };
        this.validateAccount = (req, res) => {
            const { token } = req.params;
            this.userService
                .validateEmail(token)
                .then((data) => res.status(200).json(data))
                .catch((error) => this.handleError(error, res));
        };
        this.getProfile = (req, res) => {
            this.userService
                .getUserProfile(req.body.sessionUser)
                .then((data) => res.status(200).json(data))
                .catch((error) => this.handleError(error, res));
        };
        this.blockAccount = (req, res) => {
            this.userService
                .blockAccount()
                .then((data) => res.status(200).json(data))
                .catch((error) => this.handleError(error, res));
        };
        //ADMINISTRADOR
        // 1. Listar todos los usuarios
        this.findAllUsers = (req, res) => {
            const page = parseInt(req.query.page) || 1;
            this.userService
                .findAllUsers(page)
                .then((data) => res.status(200).json(data))
                .catch((error) => this.handleError(error, res));
        };
        // 2. Buscar usuarios por campos
        this.searchUsersByFields = (req, res) => {
            const [error, dto] = domain_1.SearchUserDTO.create(req.query);
            if (error)
                return res.status(400).json({ message: error });
            this.userService
                .searchUsersByFields(dto)
                .then((data) => res.status(200).json(data))
                .catch((err) => this.handleError(err, res));
        };
        // 3. Filtrar por estado
        this.filterUsersByStatus = (req, res) => __awaiter(this, void 0, void 0, function* () {
            const [error, dto] = domain_1.FilterUsersByStatusDTO.create(req.body);
            if (error)
                return res.status(400).json({ message: error });
            try {
                const data = yield this.userService.filterUsersByStatus(dto);
                return res.status(200).json(data);
            }
            catch (err) {
                this.handleError(err, res);
            }
        });
        // 4. Perfil completo
        // En tu controlador
        this.getFullUserProfile = (req, res) => __awaiter(this, void 0, void 0, function* () {
            const { id } = req.params;
            try {
                const data = yield this.userService.getFullUserProfile(id);
                return res.status(200).json(data);
            }
            catch (error) {
                this.handleError(error, res);
            }
        });
        // 5. Actualizar usuario desde admin
        this.updateUserFromAdmin = (req, res) => {
            const { id } = req.params;
            const [error, dto] = domain_1.UpdateUserAdminDTO.create(req.body);
            if (error)
                return res.status(400).json({ message: error });
            this.userService
                .updateUserFromAdmin(id, dto, req.file)
                .then((data) => res.status(200).json(data))
                .catch((err) => this.handleError(err, res));
        };
        // 6. Cambiar estado del usuario
        this.changeUserStatus = (req, res) => {
            const [error, dto] = domain_1.UpdateUserStatusDTO.create(req.body);
            if (error)
                return res.status(400).json({ message: error });
            this.userService
                .changeUserStatus(dto.id, dto)
                .then(() => res.status(200).json({ message: "Estado actualizado correctamente" }))
                .catch((err) => this.handleError(err, res));
        };
        // 9. Exportar CSV
        this.exportUsersToCSV = (_req, res) => {
            this.userService
                .exportUsersToCSV()
                .then((csv) => {
                res.setHeader("Content-Type", "text/csv");
                res.setHeader("Content-Disposition", "attachment; filename=usuarios.csv");
                res.status(200).send(csv);
            })
                .catch((err) => this.handleError(err, res));
        };
        // 10. Enviar notificación
        this.sendNotificationToUser = (req, res) => {
            const [error, dto] = domain_1.SendNotificationDTO.create(req.body);
            if (error) {
                return res.status(400).json({ message: error });
            }
            this.userService
                .sendNotificationToUser(dto)
                .then(() => res.status(200).json({ message: "Notificación enviada correctamente" }))
                .catch((err) => this.handleError(err, res));
        };
        this.sendNotificationToAllUsers = (req, res) => {
            const { subject, message } = req.body;
            // Validar mínimo el asunto y mensaje
            if (!subject ||
                subject.trim().length < 3 ||
                !message ||
                message.trim().length < 5) {
                return res
                    .status(400)
                    .json({ message: "Asunto y mensaje son obligatorios" });
            }
            this.userService
                .sendNotificationToAllUsers({
                subject: subject.trim(),
                message: message.trim(),
            })
                .then((data) => res.status(200).json(data))
                .catch((err) => this.handleError(err, res));
        };
        // Total de usuarios activos
        this.countActiveUsers = (_req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                const total = yield this.userService.countActiveUsers();
                return res.status(200).json({ success: true, total });
            }
            catch (error) {
                return this.handleError(error, res);
            }
        });
        // Usuarios registrados en las últimas 24 horas
        this.countUsersRegisteredLast24h = (_req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                const total = yield this.userService.countUsersRegisteredLast24h();
                return res.status(200).json({ success: true, total, windowHours: 24 });
            }
            catch (error) {
                return this.handleError(error, res);
            }
        });
        // 11. Purgar usuario (Eliminación definitiva)
        this.purgeUser = (req, res) => {
            const { id } = req.params;
            this.userService
                .purgeUser(id)
                .then((data) => res.status(200).json(data))
                .catch((error) => this.handleError(error, res));
        };
        // ===================== NUEVOS MÉTODOS DE GESTIÓN AVANZADA =====================
        this.updateUserAdminAction = (req, res) => __awaiter(this, void 0, void 0, function* () {
            const { id } = req.params;
            const { email, whatsapp, status } = req.body;
            try {
                const result = yield this.userService.updateUserAdmin(id, { email, whatsapp, status });
                return res.status(200).json(result);
            }
            catch (error) {
                this.handleError(error, res);
            }
        });
        this.forceLogoutAdminAction = (req, res) => __awaiter(this, void 0, void 0, function* () {
            const { id } = req.params;
            try {
                const result = yield this.userService.forceLogoutAdmin(id);
                return res.status(200).json(result);
            }
            catch (error) {
                this.handleError(error, res);
            }
        });
        this.sendPasswordResetAdminAction = (req, res) => __awaiter(this, void 0, void 0, function* () {
            const { id } = req.params;
            try {
                const result = yield this.userService.sendPasswordResetAdmin(id);
                return res.status(200).json(result);
            }
            catch (error) {
                this.handleError(error, res);
            }
        });
        this.purgeUserAdminAction = (req, res) => __awaiter(this, void 0, void 0, function* () {
            const { id } = req.params;
            try {
                const result = yield this.userService.purgeUserAdmin(id);
                return res.status(200).json(result);
            }
            catch (error) {
                this.handleError(error, res);
            }
        });
    }
}
exports.UserController = UserController;
