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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.JwtAdapterAdmin = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const env_1 = require("./env");
const JWT_SEED = env_1.envs.JWT_SEED;
class JwtAdapterAdmin {
    static generateTokenAdmin(payload_1) {
        return __awaiter(this, arguments, void 0, function* (payload, duration = env_1.envs.JWT_EXPIRE_IN) {
            return new Promise((resolve) => {
                jsonwebtoken_1.default.sign(payload, JWT_SEED, { expiresIn: duration }, (err, tokenadmin) => {
                    if (err)
                        return resolve(null);
                    resolve(tokenadmin);
                });
            });
        });
    }
    static validateTokenAdmin(tokenadmin) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve) => {
                jsonwebtoken_1.default.verify(tokenadmin, JWT_SEED, (err, decoded) => {
                    if (err)
                        return resolve(null);
                    resolve(decoded);
                });
            });
        });
    }
}
exports.JwtAdapterAdmin = JwtAdapterAdmin;
