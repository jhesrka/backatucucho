"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateUserRoleDTO = void 0;
const data_1 = require("../../../data");
class UpdateUserRoleDTO {
    constructor(id, rol) {
        this.id = id;
        this.rol = rol;
    }
    static create(data) {
        const errors = [];
        if (!data.id || typeof data.id !== "string") {
            errors.push("El ID es requerido y debe ser un string.");
        }
        if (!Object.values(data_1.UserRole).includes(data.rol)) {
            errors.push("El rol no es válido.");
        }
        return errors.length > 0 ? [errors] : [undefined, new UpdateUserRoleDTO(data.id, data.rol)];
    }
}
exports.UpdateUserRoleDTO = UpdateUserRoleDTO;
