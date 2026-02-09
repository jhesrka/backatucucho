"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LoginAdminUserDTO = void 0;
const config_1 = require("../../../../config");
class LoginAdminUserDTO {
    constructor(username, password) {
        this.username = username;
        this.password = password;
    }
    static create(object) {
        const { username, password } = object;
        const errors = [];
        // Validaciones internas, pero sin detallar al usuario
        const isUsernameValid = typeof username === "string" && username.trim().length >= 4;
        const isPasswordValid = typeof password === "string" && config_1.regularExp.password.test(password.trim());
        if (!isUsernameValid || !isPasswordValid) {
            errors.push("Credenciales inválidas"); // Mensaje genérico
            return [errors];
        }
        return [undefined, new LoginAdminUserDTO(username.trim(), password.trim())];
    }
}
exports.LoginAdminUserDTO = LoginAdminUserDTO;
