"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ResetPasswordUserDTO = void 0;
class ResetPasswordUserDTO {
    constructor(token, newPassword) {
        this.token = token;
        this.newPassword = newPassword;
    }
    static create(object) {
        const { token, newPassword } = object;
        const errors = [];
        if (typeof token !== "string" || token.trim().length < 10) {
            errors.push("Token inválido o muy corto.");
        }
        if (typeof newPassword !== "string") {
            errors.push("La contraseña es obligatoria.");
        }
        else {
            const trimmed = newPassword.trim();
            if (trimmed.length < 8) {
                errors.push("La contraseña debe tener al menos 8 caracteres.");
            }
            if (!/[A-Z]/.test(trimmed)) {
                errors.push("Debe contener al menos una letra mayúscula.");
            }
            if (!/[a-z]/.test(trimmed)) {
                errors.push("Debe contener al menos una letra minúscula.");
            }
            if (!/[0-9]/.test(trimmed)) {
                errors.push("Debe contener al menos un número.");
            }
            if (!/[^A-Za-z0-9]/.test(trimmed)) {
                errors.push("Debe contener al menos un símbolo.");
            }
        }
        if (errors.length > 0)
            return [errors];
        return [[], new ResetPasswordUserDTO(token.trim(), newPassword.trim())];
    }
}
exports.ResetPasswordUserDTO = ResetPasswordUserDTO;
