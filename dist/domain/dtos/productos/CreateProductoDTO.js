"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateProductoDTO = void 0;
const config_1 = require("../../../config");
class CreateProductoDTO {
    constructor(nombre, descripcion, precio_venta, precio_app, negocioId, modeloMonetizacion, tipoId) {
        this.nombre = nombre;
        this.descripcion = descripcion;
        this.precio_venta = precio_venta;
        this.precio_app = precio_app;
        this.negocioId = negocioId;
        this.modeloMonetizacion = modeloMonetizacion;
        this.tipoId = tipoId;
    }
    static create(obj) {
        const { nombre, descripcion, precio_venta, precio_app, negocioId, modeloMonetizacion, tipoId, } = obj;
        if (!nombre || typeof nombre !== "string" || nombre.trim().length < 3) {
            return ["El nombre del producto debe tener al menos 3 caracteres"];
        }
        if (!descripcion || typeof descripcion !== "string" || descripcion.trim().length < 5) {
            return ["La descripción debe tener al menos 5 caracteres"];
        }
        if (isNaN(Number(precio_venta)) || Number(precio_venta) <= 0) {
            return ["El precio de venta debe ser un número positivo"];
        }
        if (!negocioId || typeof negocioId !== "string" || !config_1.regularExp.uuid.test(negocioId)) {
            return ["El ID del negocio no es válido"];
        }
        if (!modeloMonetizacion || !["SUSCRIPCION", "COMISION_SUSCRIPCION"].includes(modeloMonetizacion)) {
            return ["Modelo de monetización inválido"];
        }
        if (modeloMonetizacion === "COMISION_SUSCRIPCION") {
            if (precio_app === undefined || precio_app === null) {
                return ["Debes proporcionar 'precio_app' para negocios con modelo COMISION + SUSCRIPCION"];
            }
            if (isNaN(Number(precio_app)) || Number(precio_app) <= 0) {
                return ["El precio para la app debe ser un número positivo"];
            }
            if (Number(precio_app) >= Number(precio_venta)) {
                return ["El precio para la app debe ser menor que el precio de venta"];
            }
        }
        if (!tipoId || typeof tipoId !== "string" || !config_1.regularExp.uuid.test(tipoId)) {
            return ["Debes seleccionar un tipo válido"];
        }
        return [
            undefined,
            new CreateProductoDTO(nombre.trim(), descripcion.trim(), Number(precio_venta), modeloMonetizacion === "COMISION_SUSCRIPCION" ? Number(precio_app) : Number(precio_venta), negocioId, modeloMonetizacion, tipoId.trim()),
        ];
    }
}
exports.CreateProductoDTO = CreateProductoDTO;
