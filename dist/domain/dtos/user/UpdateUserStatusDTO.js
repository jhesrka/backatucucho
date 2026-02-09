"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateUserStatusDTO = void 0;
const data_1 = require("../../../data");
class UpdateUserStatusDTO {
    constructor(id, status) {
        this.id = id;
        this.status = status;
    }
    static create(data) {
        const errors = [];
        if (!data.id || typeof data.id !== "string") {
            errors.push("El ID es requerido y debe ser un string.");
        }
        if (!Object.values(data_1.Status).includes(data.status)) {
            errors.push("El estado no es válido.");
        }
        return errors.length > 0 ? [errors] : [undefined, new UpdateUserStatusDTO(data.id, data.status)];
    }
}
exports.UpdateUserStatusDTO = UpdateUserStatusDTO;
