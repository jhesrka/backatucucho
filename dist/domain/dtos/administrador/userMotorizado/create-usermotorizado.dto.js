"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateMotorizadoDTO = void 0;
const config_1 = require("../../../../config");
class CreateMotorizadoDTO {
    constructor(name, surname, whatsapp, cedula, password) {
        this.name = name;
        this.surname = surname;
        this.whatsapp = whatsapp;
        this.cedula = cedula;
        this.password = password;
    }
    static create(object) {
        const { name, surname, password, whatsapp, cedula } = object;
        // Validación de nombre
        if (!name || name.trim().length < 2) {
            return ["El nombre es obligatorio y debe tener al menos 2 caracteres"];
        }
        // Validación de apellido
        if (!surname || surname.trim().length < 2) {
            return ["El apellido es obligatorio y debe tener al menos 2 caracteres"];
        }
        // Validación de contraseña (Opcional)
        if (password) {
            if (!config_1.regularExp.password.test(password)) {
                return [
                    "La contraseña debe tener mínimo 8 caracteres, al menos una mayúscula, una minúscula, un número y un símbolo",
                ];
            }
        }
        // Validación de WhatsApp
        if (!whatsapp)
            return ["El número de WhatsApp es obligatorio"];
        if (!config_1.regularExp.phone.test(whatsapp)) {
            return ["El número de WhatsApp debe tener exactamente 10 dígitos"];
        }
        // Validación de cédula
        if (!cedula && cedula !== 0)
            return ["La cédula es obligatoria"];
        if (!config_1.regularExp.cedula.test(cedula.toString())) {
            return ["La cédula debe tener exactamente 10 dígitos"];
        }
        return [undefined, new CreateMotorizadoDTO(name, surname, whatsapp, cedula, password)];
    }
}
exports.CreateMotorizadoDTO = CreateMotorizadoDTO;
