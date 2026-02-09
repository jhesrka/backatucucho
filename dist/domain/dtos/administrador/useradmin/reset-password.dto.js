"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ResetPasswordDTO = void 0;
class ResetPasswordDTO {
    constructor(token, newPassword) {
        this.token = token;
        this.newPassword = newPassword;
    }
    static create(object) {
        const { token, newPassword } = object;
        const errors = [];
        // Validar el token
        if (typeof token !== "string" || token.trim().length < 10) {
            errors.push("Token inválido o muy corto.");
        }
        // Validar la nueva contraseña
        if (typeof newPassword !== "string") {
            errors.push("La contraseña es obligatoria.");
        }
        else {
            const trimmedPassword = newPassword.trim();
            if (trimmedPassword.length < 8) {
                errors.push("La contraseña debe tener al menos 8 caracteres.");
            }
            if (!/[A-Z]/.test(trimmedPassword)) {
                errors.push("Debe contener al menos una letra mayúscula.");
            }
            if (!/[a-z]/.test(trimmedPassword)) {
                errors.push("Debe contener al menos una letra minúscula.");
            }
            if (!/[0-9]/.test(trimmedPassword)) {
                errors.push("Debe contener al menos un número.");
            }
            if (!/[^A-Za-z0-9]/.test(trimmedPassword)) {
                errors.push("Debe contener al menos un símbolo.");
            }
        }
        if (errors.length > 0)
            return [errors];
        return [[], new ResetPasswordDTO(token.trim(), newPassword.trim())];
    }
}
exports.ResetPasswordDTO = ResetPasswordDTO;
