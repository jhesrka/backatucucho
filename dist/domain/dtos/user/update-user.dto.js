"use strict";
// src/domain/dtos/user/update-user.dto.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateUserDTO = void 0;
class UpdateUserDTO {
    constructor(name, surname, birthday, // Fecha como string
    photoperfil // Es opcional
    ) {
        this.name = name;
        this.surname = surname;
        this.birthday = birthday;
        this.photoperfil = photoperfil;
    }
    static create(object) {
        const { name, surname, birthday, photoperfil } = object;
        if (name === undefined &&
            surname === undefined &&
            birthday === undefined &&
            photoperfil === undefined) {
            return ["No se proporcionaron datos válidos para actualizar"];
        }
        return [undefined, new UpdateUserDTO(name, surname, birthday, photoperfil)];
    }
}
exports.UpdateUserDTO = UpdateUserDTO;
