"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChangePasswordUserDTO = void 0;
const config_1 = require("../../../config");
class ChangePasswordUserDTO {
    constructor(currentPassword, newPassword) {
        this.currentPassword = currentPassword;
        this.newPassword = newPassword;
    }
    static create(object) {
        const { currentPassword, newPassword, confirmNewPassword } = object;
        if (!currentPassword)
            return ['La contraseña actual es requerida'];
        if (!newPassword)
            return ['La nueva contraseña es requerida'];
        if (newPassword !== confirmNewPassword)
            return ['Las contraseñas no coinciden'];
        if (!config_1.regularExp.password.test(newPassword)) {
            return [
                "La nueva contraseña no cumple los requisitos (8 caracteres, mayuscula, minuscula, numero, simbolo)"
            ];
        }
        if (currentPassword === newPassword)
            return ['La nueva contraseña no puede ser igual a la anterior'];
        return [undefined, new ChangePasswordUserDTO(currentPassword, newPassword)];
    }
}
exports.ChangePasswordUserDTO = ChangePasswordUserDTO;
