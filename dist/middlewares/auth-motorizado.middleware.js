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
exports.AuthMotorizadoMiddleware = void 0;
const data_1 = require("../data");
const config_1 = require("../config");
class AuthMotorizadoMiddleware {
    static protect(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            const authorization = req.header("Authorization");
            if (!authorization) {
                return res.status(401).json({ message: "No token provided" });
            }
            if (!authorization.startsWith("Bearer ")) {
                return res.status(401).json({ message: "Invalid token format" });
            }
            const token = authorization.split(" ")[1];
            try {
                // 🔐 Validar JWT
                const payload = (yield config_1.JwtAdapterMotorizado.validateTokenMotorizado(token));
                if (!(payload === null || payload === void 0 ? void 0 : payload.id)) {
                    return res.status(401).json({ message: "Invalid token" });
                }
                // 🔎 Buscar motorizado activo
                const motorizado = yield data_1.UserMotorizado.findOne({
                    where: {
                        id: payload.id,
                        estadoCuenta: data_1.EstadoCuentaMotorizado.ACTIVO,
                    },
                });
                if (!motorizado) {
                    return res.status(401).json({ message: "Motorizado no autorizado" });
                }
                // 🔒 VALIDACIÓN CLAVE: tokenVersion (logout real)
                if (payload.tokenVersion !== undefined &&
                    payload.tokenVersion !== motorizado.tokenVersion) {
                    return res.status(401).json({ message: "Sesión inválida" });
                }
                // ✅ Mantener compatibilidad con tu sistema actual
                req.body.sessionMotorizado = motorizado;
                next();
            }
            catch (error) {
                return res.status(401).json({ message: "Token inválido o expirado" });
            }
        });
    }
}
exports.AuthMotorizadoMiddleware = AuthMotorizadoMiddleware;
