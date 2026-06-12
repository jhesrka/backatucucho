"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LoginAdminUserDTO = void 0;
const config_1 = require("../../../../config");
class LoginAdminUserDTO {
    constructor(username, password, ip, userAgent) {
        this.username = username;
        this.password = password;
        this.ip = ip;
        this.userAgent = userAgent;
    }
    static create(object) {
        const { username, password, ip, userAgent } = object;
        const errors = [];
        // Validaciones internas, pero sin detallar al usuario
        const isUsernameValid = typeof username === "string" && username.trim().length >= 4;
        const isPasswordValid = typeof password === "string" && config_1.regularExp.password.test(password.trim());
        if (!isUsernameValid || !isPasswordValid) {
            errors.push("Credenciales inválidas"); // Mensaje genérico
            return [errors];
        }
        return [undefined, new LoginAdminUserDTO(username.trim(), password.trim(), ip, userAgent)];
    }
}
exports.LoginAdminUserDTO = LoginAdminUserDTO;
