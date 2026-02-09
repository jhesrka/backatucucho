"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateNegocioDTO = void 0;
// src/domain/dtos/negocios/UpdateNegocioDTO.ts
const config_1 = require("../../../config");
const data_1 = require("../../../data");
class UpdateNegocioDTO {
    constructor(nombre, descripcion, categoriaId, statusNegocio, modeloMonetizacion, latitud, longitud, direccionTexto, valorSuscripcion, diaPago, masterPin) {
        this.nombre = nombre;
        this.descripcion = descripcion;
        this.categoriaId = categoriaId;
        this.statusNegocio = statusNegocio;
        this.modeloMonetizacion = modeloMonetizacion;
        this.latitud = latitud;
        this.longitud = longitud;
        this.direccionTexto = direccionTexto;
        this.valorSuscripcion = valorSuscripcion;
        this.diaPago = diaPago;
        this.masterPin = masterPin;
    }
    static create(obj) {
        const { nombre, descripcion, categoriaId, statusNegocio, modeloMonetizacion, latitud, longitud, direccionTexto, valorSuscripcion, diaPago, } = obj;
        // Validaciones opcionales
        if (nombre !== undefined && (typeof nombre !== "string" || nombre.trim().length < 3)) {
            return ["El nombre del negocio debe tener al menos 3 caracteres"];
        }
        if (descripcion !== undefined && (typeof descripcion !== "string" || descripcion.trim().length < 10)) {
            return ["La descripción debe tener al menos 10 caracteres"];
        }
        if (categoriaId !== undefined && (!config_1.regularExp.uuid.test(categoriaId))) {
            return ["El ID de categoría no es válido"];
        }
        if (statusNegocio !== undefined && !Object.values(data_1.StatusNegocio).includes(statusNegocio)) {
            return ["Estado de negocio inválido"];
        }
        if (modeloMonetizacion !== undefined &&
            !Object.values(data_1.ModeloMonetizacion).includes(modeloMonetizacion)) {
            return ["Debes seleccionar un modelo de monetización válido"];
        }
        if (latitud !== undefined) {
            const lat = Number(latitud);
            if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
                return ["Latitud inválida"];
            }
        }
        if (longitud !== undefined) {
            const lng = Number(longitud);
            if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
                return ["Longitud inválida"];
            }
        }
        if (valorSuscripcion !== undefined) {
            const val = Number(valorSuscripcion);
            if (isNaN(val) || val < 0) {
                return ["El valor de suscripción debe ser un número positivo"];
            }
        }
        if (diaPago !== undefined) {
            const dia = Number(diaPago);
            if (isNaN(dia) || dia < 1 || dia > 31) {
                return ["El día de pago debe ser entre 1 y 31"];
            }
        }
        const dirTxt = typeof direccionTexto === "string" && direccionTexto.trim().length > 0
            ? direccionTexto.trim().slice(0, 200)
            : undefined;
        return [
            undefined,
            new UpdateNegocioDTO(nombre === null || nombre === void 0 ? void 0 : nombre.trim(), descripcion === null || descripcion === void 0 ? void 0 : descripcion.trim(), categoriaId, statusNegocio, modeloMonetizacion, latitud !== undefined ? Number(latitud) : undefined, longitud !== undefined ? Number(longitud) : undefined, dirTxt, valorSuscripcion !== undefined ? Number(valorSuscripcion) : undefined, diaPago !== undefined ? Number(diaPago) : undefined, obj.masterPin),
        ];
    }
}
exports.UpdateNegocioDTO = UpdateNegocioDTO;
