"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FilterUsersByStatusDTO = void 0;
const data_1 = require("../../../data");
class FilterUsersByStatusDTO {
    constructor(status) {
        this.status = status;
    }
    static create(data) {
        const errors = [];
        if (!data.status || typeof data.status !== "string") {
            errors.push("El estado es requerido y debe ser un string.");
        }
        else if (!Object.values(data_1.Status).includes(data.status)) {
            errors.push("El estado proporcionado no es válido.");
        }
        return errors.length > 0
            ? [errors]
            : [undefined, new FilterUsersByStatusDTO(data.status)];
    }
}
exports.FilterUsersByStatusDTO = FilterUsersByStatusDTO;
