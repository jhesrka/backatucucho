"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateUserAdminDTO = void 0;
class UpdateUserAdminDTO {
    static create(data) {
        const errors = [];
        if ("name" in data && typeof data.name !== "string") {
            errors.push("El nombre debe ser un string.");
        }
        if ("surname" in data && typeof data.surname !== "string") {
            errors.push("El apellido debe ser un string.");
        }
        if ("birthday" in data && data.birthday && isNaN(Date.parse(data.birthday))) {
            errors.push("La fecha de cumpleaños no es válida.");
        }
        if ("email" in data && typeof data.email !== "string") {
            errors.push("El email debe ser un string.");
        }
        if ("whatsapp" in data && typeof data.whatsapp !== "string") {
            errors.push("El número de WhatsApp debe ser un string.");
        }
        if (errors.length > 0)
            return [errors];
        const dto = new UpdateUserAdminDTO();
        if ("name" in data)
            dto.name = data.name;
        if ("surname" in data)
            dto.surname = data.surname;
        if ("birthday" in data)
            dto.birthday = data.birthday;
        if ("email" in data)
            dto.email = data.email;
        if ("whatsapp" in data)
            dto.whatsapp = data.whatsapp;
        return [undefined, dto];
    }
}
exports.UpdateUserAdminDTO = UpdateUserAdminDTO;
