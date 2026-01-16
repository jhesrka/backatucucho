"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateUserDTO = void 0;
// src/domain/dtos/user/update-user.dto.ts
class UpdateUserDTO {
    constructor(name, surname, email, password, birthday, // Fecha como string
    whatsapp, photoperfil // Es opcional
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
        if (name === undefined && surname === undefined && email === undefined && password === undefined && birthday === undefined && whatsapp === undefined && photoperfil === undefined) {
            return ["No se proporcionaron datos para actualizar"];
        }
        return [undefined, new UpdateUserDTO(name, surname, email, password, birthday, whatsapp, photoperfil)];
    }
}
exports.UpdateUserDTO = UpdateUserDTO;
