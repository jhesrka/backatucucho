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
exports.AuthService = void 0;
const config_1 = require("../../config");
const data_1 = require("../../data");
const domain_1 = require("../../domain");
class AuthService {
    constructor() { }
    refreshToken(refreshToken) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!refreshToken)
                throw domain_1.CustomError.badRequest("Refresh token is required");
            // 1. Validar el token usando el adaptador genérico (misma SEED para todos)
            const payload = yield config_1.JwtAdapter.validateToken(refreshToken);
            if (!payload || !payload.id || !payload.role) {
                throw domain_1.CustomError.unAuthorized("Invalid or expired refresh token");
            }
            const { id, role } = payload;
            let user = null;
            let isActive = false;
            // 2. Verificar usuario según el rol
            switch (role) {
                case "USER":
                    user = yield data_1.User.findOne({ where: { id } });
                    isActive = user && user.status === data_1.Status.ACTIVE;
                    break;
                case "ADMIN":
                    user = yield data_1.Useradmin.findOne({ where: { id } });
                    isActive = user && user.status === data_1.Statusadmin.ACTIVE;
                    break;
                case "MOTORIZADO":
                    user = yield data_1.UserMotorizado.findOne({ where: { id } });
                    isActive = user && user.estadoCuenta === data_1.EstadoCuentaMotorizado.ACTIVO;
                    break;
                default:
                    throw domain_1.CustomError.unAuthorized("Invalid role in token");
            }
            if (!user)
                throw domain_1.CustomError.notFound("User not found");
            if (!isActive)
                throw domain_1.CustomError.unAuthorized("User is inactive or blocked");
            // 3. Generar nuevos tokens (Rotación de Refresh Token)
            const newAccessToken = yield config_1.JwtAdapter.generateToken({ id: user.id, role }, config_1.envs.JWT_EXPIRE_IN);
            const newRefreshToken = yield config_1.JwtAdapter.generateToken({ id: user.id, role }, config_1.envs.JWT_REFRESH_EXPIRE_IN);
            if (!newAccessToken || !newRefreshToken)
                throw domain_1.CustomError.internalServer("Error allocating tokens");
            // Actualizar sesión válida en DB para que el middleware acepte el nuevo token
            user.currentSessionId = newAccessToken;
            yield user.save();
            // 4. Retornar
            return {
                token: newAccessToken,
                refreshToken: newRefreshToken,
                role
            };
        });
    }
}
exports.AuthService = AuthService;
