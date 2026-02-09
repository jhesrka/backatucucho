"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LoginMotorizadoUserDTO = void 0;
const config_1 = require("../../../../config");
class LoginMotorizadoUserDTO {
    constructor(cedula, password) {
        this.cedula = cedula;
        this.password = password;
    }
    static create(object) {
        const { cedula, password } = object;
        const errors = [];
        // Validaciones internas
        const isCedulaValid = typeof cedula === "string" && config_1.regularExp.cedula.test(cedula.trim());
        const isPasswordValid = typeof password === "string" && password.length > 0;
        // Mensaje genérico si algo está mal
        if (!isCedulaValid || !isPasswordValid) {
            errors.push("Credenciales inválidas");
            return [errors];
        }
        return [undefined, new LoginMotorizadoUserDTO(cedula.trim(), password.trim())];
    }
}
exports.LoginMotorizadoUserDTO = LoginMotorizadoUserDTO;
