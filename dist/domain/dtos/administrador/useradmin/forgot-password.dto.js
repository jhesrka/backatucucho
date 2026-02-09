"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ForgotPasswordDTO = void 0;
class ForgotPasswordDTO {
    constructor(email) {
        this.email = email;
    }
    static create(object) {
        const errors = [];
        if (!object || typeof object.email !== "string") {
            errors.push("El correo es obligatorio.");
            return [errors];
        }
        const email = object.email.trim();
        if (email.length < 5) {
            errors.push("El correo es demasiado corto.");
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            errors.push("El correo ingresado no es válido.");
        }
        if (/\s/.test(email)) {
            errors.push("El correo no debe contener espacios.");
        }
        if (/[A-Z]/.test(email)) {
            errors.push("El correo no debe contener letras mayúsculas.");
        }
        if (errors.length > 0)
            return [errors];
        return [undefined, new ForgotPasswordDTO(email.toLowerCase())];
    }
}
exports.ForgotPasswordDTO = ForgotPasswordDTO;
