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
                return res.status(401).json({ message: "No Token provided" });
            if (!authorization.startsWith("Bearer "))
                return res.status(401).json({ message: "Invalid token" });
            const token = authorization.split(" ").at(1) || "";
            try {
                const payload = (yield config_1.JwtAdapter.validateToken(token));
                if (!payload)
                    return res.status(401).json({ message: "Invalid Token" });
                const user = yield data_1.User.findOne({
                    where: {
                        id: payload.id,
                        status: data_1.Status.ACTIVE,
                    },
                });
                if (!user)
                    return res.status(401).json({ message: "invalid user" });
                req.body.sessionUser = user;
                next();
            }
            catch (error) {
                return res.status(500).json({ message: "Interval Server Error" });
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
                .json({ message: "No tienes acceso a esta ruta" });
        }
        next();
    };
};
