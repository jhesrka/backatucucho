"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateTipoProductoDTO = void 0;
// src/data/dtos/CreateTipoProductoDTO.ts
class CreateTipoProductoDTO {
    constructor(nombre) {
        this.nombre = nombre;
    }
    static create(obj) {
        const { nombre } = obj;
        if (!nombre || typeof nombre !== "string" || nombre.trim().length < 3) {
            return ["El nombre del tipo de producto debe tener al menos 3 caracteres"];
        }
        return [undefined, new CreateTipoProductoDTO(nombre.trim())];
    }
}
exports.CreateTipoProductoDTO = CreateTipoProductoDTO;
