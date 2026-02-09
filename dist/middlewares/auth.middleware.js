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
exports.AuthMiddleware = void 0;
const config_1 = require("../config");
const data_1 = require("../data");
class AuthMiddleware {
    static protect(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            const authorization = req.header("Authorization");
            if (!authorization)
                return res
                    .status(401)
                    .json({ message: "Token no proporcionado o inválido" });
            if (!authorization.startsWith("Bearer "))
                return res
                    .status(401)
                    .json({ message: "Token no proporcionado o inválido" });
            const token = authorization.split(" ").at(1) || "";
            try {
                const payload = (yield config_1.JwtAdapter.validateToken(token));
                if (!payload) {
                    return res.status(401).json({
                        message: "Token expirado. Por favor inicia sesión nuevamente.",
                    });
                }
                const user = yield data_1.User.findOne({
                    where: {
                        id: payload.id,
                        status: data_1.Status.ACTIVE,
                    },
                });
                if (!user)
                    return res
                        .status(401)
                        .json({ message: "Usuario no válido o inactivo" });
                // Validar sesión única (backend restriction)
                // Validar sesión única (backend restriction)
                // if (user.currentSessionId && user.currentSessionId !== token) {
                //   return res.status(401).json({
                //     message: "Tu sesión fue cerrada porque iniciaste sesión en otro dispositivo",
                //   });
                // }
                req.body.sessionUser = user;
                next();
            }
            catch (error) {
                // Si el token es inválido o expirado, esto lo atrapará
                return res
                    .status(401)
                    .json({
                    message: "Token inválido o expirado. Inicia sesión nuevamente.",
                });
            }
        });
    }
}
exports.AuthMiddleware = AuthMiddleware;
AuthMiddleware.restrictTo = (...roles) => {
    return (req, res, next) => {
        if (!roles.includes(req.body.sessionUser.rol)) {
            return res
                .status(403)
                .json({ message: "No tienes permiso para acceder a esta ruta" });
        }
        next();
    };
};
