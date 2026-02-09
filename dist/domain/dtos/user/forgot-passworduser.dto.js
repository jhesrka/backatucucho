"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ForgotPasswordUserDTO = void 0;
class ForgotPasswordUserDTO {
    constructor(email) {
        this.email = email;
    }
    static create(object) {
        const { email } = object;
        const errors = [];
        if (!email || typeof email !== "string") {
            errors.push("El correo es obligatorio.");
        }
        else {
            const trimmedEmail = email.trim().toLowerCase();
            if (!trimmedEmail.includes("@") || !trimmedEmail.includes(".")) {
                errors.push("El correo ingresado no es válido.");
            }
            if (trimmedEmail.length < 5) {
                errors.push("El correo es demasiado corto.");
            }
            if (/\s/.test(trimmedEmail)) {
                errors.push("El correo no debe contener espacios.");
            }
            if (/[A-Z]/.test(email)) {
                errors.push("El correo no debe contener letras mayúsculas.");
            }
            if (errors.length > 0)
                return [errors];
            return [undefined, new ForgotPasswordUserDTO(trimmedEmail)];
        }
        return [errors];
    }
}
exports.ForgotPasswordUserDTO = ForgotPasswordUserDTO;
