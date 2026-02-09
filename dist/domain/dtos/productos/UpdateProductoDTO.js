"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateProductoDTO = void 0;
const config_1 = require("../../../config");
class UpdateProductoDTO {
    constructor(nombre, descripcion, precio_venta, precio_app, tipoId, modeloMonetizacion) {
        this.nombre = nombre;
        this.descripcion = descripcion;
        this.precio_venta = precio_venta;
        this.precio_app = precio_app;
        this.tipoId = tipoId;
        this.modeloMonetizacion = modeloMonetizacion;
    }
    static create(obj) {
        const { nombre, descripcion, precio_venta, precio_app, tipoId, modeloMonetizacion, } = obj;
        if (nombre && (typeof nombre !== "string" || nombre.trim().length < 3)) {
            return ["El nombre debe tener al menos 3 caracteres"];
        }
        if (descripcion && (typeof descripcion !== "string" || descripcion.trim().length < 5)) {
            return ["La descripción debe tener al menos 5 caracteres"];
        }
        if (precio_venta !== undefined && (isNaN(Number(precio_venta)) || Number(precio_venta) <= 0)) {
            return ["El precio de venta debe ser un número positivo"];
        }
        if (modeloMonetizacion && !["SUSCRIPCION", "COMISION_SUSCRIPCION"].includes(modeloMonetizacion)) {
            return ["Modelo de monetización inválido"];
        }
        if (precio_app !== undefined && (isNaN(Number(precio_app)) || Number(precio_app) <= 0)) {
            return ["El precio para la app debe ser un número positivo"];
        }
        if (modeloMonetizacion === "COMISION_SUSCRIPCION" &&
            precio_app !== undefined &&
            precio_venta !== undefined &&
            Number(precio_app) >= Number(precio_venta)) {
            return ["El precio para la app debe ser menor que el precio de venta"];
        }
        if (tipoId && !config_1.regularExp.uuid.test(tipoId)) {
            return ["El tipoId no es un UUID válido"];
        }
        return [
            undefined,
            new UpdateProductoDTO(nombre === null || nombre === void 0 ? void 0 : nombre.trim(), descripcion === null || descripcion === void 0 ? void 0 : descripcion.trim(), precio_venta !== undefined ? Number(precio_venta) : undefined, precio_app !== undefined ? Number(precio_app) : undefined, tipoId === null || tipoId === void 0 ? void 0 : tipoId.trim(), modeloMonetizacion),
        ];
    }
}
exports.UpdateProductoDTO = UpdateProductoDTO;
