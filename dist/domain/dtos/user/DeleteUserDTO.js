"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeleteUserDTO = void 0;
class DeleteUserDTO {
    constructor(id) {
        this.id = id;
    }
    static create(data) {
        const errors = [];
        if (!data.id || typeof data.id !== "string") {
            errors.push("El ID es requerido y debe ser un string.");
        }
        return errors.length > 0 ? [errors] : [undefined, new DeleteUserDTO(data.id)];
    }
}
exports.DeleteUserDTO = DeleteUserDTO;
