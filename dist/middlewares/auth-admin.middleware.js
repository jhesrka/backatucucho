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
exports.AuthAdminMiddleware = void 0;
const data_1 = require("../data");
const jwt_adapteradmin_1 = require("../config/jwt.adapteradmin");
class AuthAdminMiddleware {
    static protect(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            const authorization = req.header("Authorization");
            if (!authorization)
                return res.status(401).json({ message: "No Token provided" });
            if (!authorization.startsWith("Bearer "))
                return res.status(401).json({ message: "Invalid token format" });
            const tokenadmin = authorization.split(" ").at(1) || "";
            try {
                const payload = (yield jwt_adapteradmin_1.JwtAdapterAdmin.validateTokenAdmin(tokenadmin));
                if (!payload)
                    return res.status(401).json({ message: "Invalid Token" });
                const useradmin = yield data_1.Useradmin.findOne({
                    where: { id: payload.id, status: data_1.Statusadmin.ACTIVE },
                });
                if (!useradmin)
                    return res.status(401).json({ message: "Admin no autorizado" });
                req.sessionAdmin = useradmin;
                req.admin = useradmin;
                req.user = useradmin;
                req.body.sessionAdmin = useradmin;
                req.body.admin = useradmin;
                req.body.user = useradmin;
                next();
            }
            catch (error) {
                // Captura cualquier error de validación JWT
                return res.status(401).json({
                    message: "Token inválido o expirado. Inicia sesión nuevamente.",
                });
            }
        });
    }
}
exports.AuthAdminMiddleware = AuthAdminMiddleware;
AuthAdminMiddleware.restrictTo = (...roles) => {
    return (req, res, next) => {
        const useradmin = req.sessionAdmin || req.body.sessionAdmin;
        if (!useradmin || !roles.includes(useradmin.rol)) {
            return res
                .status(403)
                .json({ message: "No tienes permisos como administrador" });
        }
        next();
    };
};
