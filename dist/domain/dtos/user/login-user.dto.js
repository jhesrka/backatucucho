"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LoginUserDTO = void 0;
const config_1 = require("../../../config");
// src/domain/dtos/user/create-user.dto.ts
class LoginUserDTO {
    constructor(email, password, ip, force = false) {
        this.email = email;
        this.password = password;
        this.ip = ip;
        this.force = force;
    }
    static create(object) {
        const { email, password, ip, force } = object;
        // Validación de email
        if (!email)
            return ["El correo electrónico es obligatorio"];
        if (!config_1.regularExp.email.test(email))
            return ["El formato del correo electrónico no es válido"];
        // Validación de contraseña
        if (!password)
            return ["La contraseña es obligatoria"];
        if (!config_1.regularExp.password.test(password)) {
            return [
                "La contraseña debe tener mínimo 8 caracteres, al menos una mayúscula, una minúscula, un número y un símbolo",
            ];
        }
        return [undefined, new LoginUserDTO(email, password, ip, !!force)];
    }
}
exports.LoginUserDTO = LoginUserDTO;
