"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ForgotPasswordMotorizadoDTO = void 0;
class ForgotPasswordMotorizadoDTO {
    constructor(cedula) {
        this.cedula = cedula;
    }
    static create(object) {
        const { cedula } = object;
        const errors = [];
        if (!cedula || typeof cedula !== "string") {
            errors.push("La cédula es obligatoria.");
        }
        else {
            const trimmed = cedula.trim();
            if (!/^\d{9,12}$/.test(trimmed)) {
                errors.push("La cédula debe tener entre 9 y 12 dígitos numéricos.");
            }
            if (/\s/.test(trimmed)) {
                errors.push("La cédula no debe contener espacios.");
            }
        }
        return errors.length > 0 ? [errors] : [undefined, new ForgotPasswordMotorizadoDTO(cedula.trim())];
    }
}
exports.ForgotPasswordMotorizadoDTO = ForgotPasswordMotorizadoDTO;
