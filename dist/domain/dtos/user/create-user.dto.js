"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateUserDTO = void 0;
const config_1 = require("../../../config");
// src/domain/dtos/user/create-user.dto.ts
class CreateUserDTO {
    constructor(name, surname, email, password, birthday, // Fecha como string
    whatsapp, photoperfil // Eliminar 'readonly' para poder modificarlo
    ) {
        this.name = name;
        this.surname = surname;
        this.email = email;
        this.password = password;
        this.birthday = birthday;
        this.whatsapp = whatsapp;
        this.photoperfil = photoperfil;
    }
    static create(object) {
        const { name, surname, email, password, birthday, whatsapp, photoperfil } = object;
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
                "La contraseña debe tener mínimo 8 caracteres, al menos una mayúscula, una minúscula, un número y un símbolo"
            ];
        }
        // Validación de fecha
        if (!birthday)
            return ["La fecha de nacimiento es obligatoria"];
        if (!config_1.regularExp.date.test(birthday))
            return ["El formato de la fecha debe ser YYYY-MM-DD"];
        // Validación de WhatsApp
        if (!whatsapp)
            return ["El número de WhatsApp es obligatorio"];
        if (!config_1.regularExp.phone.test(whatsapp)) {
            return ["El número de WhatsApp debe tener exactamente 10 dígitos"];
        }
        return [undefined, new CreateUserDTO(name, surname, email, password, birthday, whatsapp, photoperfil)];
    }
}
exports.CreateUserDTO = CreateUserDTO;
