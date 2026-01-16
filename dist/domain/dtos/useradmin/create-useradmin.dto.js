"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateUseradminDTO = void 0;
const config_1 = require("../../../config");
class CreateUseradminDTO {
    constructor(username, name, surname, email, password, whatsapp) {
        this.username = username;
        this.name = name;
        this.surname = surname;
        this.email = email;
        this.password = password;
        this.whatsapp = whatsapp;
    }
    static create(object) {
        const { username, name, surname, email, password, whatsapp } = object;
        if (!username || username.trim().length < 2) {
            return ["El usuario es obligatorio y debe tener al menos 2 caracteres"];
        }
        // Validación de nombre
        if (!name || name.trim().length < 2) {
            return ["El nombre es obligatorio y debe tener al menos 2 caracteres"];
        }
        // Validación de apellido
        if (!surname || surname.trim().length < 2) {
            return ["El apellido es obligatorio y debe tener al menos 2 caracteres"];
        }
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
        // Validación de WhatsApp
        if (!whatsapp)
            return ["El número de WhatsApp es obligatorio"];
        if (!config_1.regularExp.phone.test(whatsapp)) {
            return ["El número de WhatsApp debe tener exactamente 10 dígitos"];
        }
        return [
            undefined,
            new CreateUseradminDTO(username, name, surname, email, password, whatsapp),
        ];
    }
}
exports.CreateUseradminDTO = CreateUseradminDTO;
