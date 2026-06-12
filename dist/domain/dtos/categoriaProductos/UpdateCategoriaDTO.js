"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateCategoriaDTO = void 0;
const data_1 = require("../../../data");
class UpdateCategoriaDTO {
    constructor(name, icon, restriccionModeloMonetizacion, soloComision, statusCategoria, orden, modeloBloqueado, modeloMonetizacionDefault, cover) {
        this.name = name;
        this.icon = icon;
        this.restriccionModeloMonetizacion = restriccionModeloMonetizacion;
        this.soloComision = soloComision;
        this.statusCategoria = statusCategoria;
        this.orden = orden;
        this.modeloBloqueado = modeloBloqueado;
        this.modeloMonetizacionDefault = modeloMonetizacionDefault;
        this.cover = cover;
    }
    static create(obj) {
        let { name, icon, restriccionModeloMonetizacion, soloComision, statusCategoria, modeloBloqueado, modeloMonetizacionDefault, cover } = obj;
        if (typeof cover === "string") {
            try {
                cover = JSON.parse(cover);
            }
            catch (e) {
                return ["El campo cover no es un JSON válido"];
            }
        }
        if (!name && !icon && !restriccionModeloMonetizacion && statusCategoria === undefined && soloComision === undefined && obj.orden === undefined && modeloBloqueado === undefined && modeloMonetizacionDefault === undefined && cover === undefined) {
            return [
                "Debes enviar al menos un campo para actualizar",
            ];
        }
        const updates = {};
        if (name !== undefined) {
            if (typeof name !== "string" || name.trim().length < 3) {
                return ["El nombre debe tener al menos 3 caracteres"];
            }
            updates.name = name.trim();
        }
        if (icon !== undefined) {
            if (typeof icon !== "string") {
                return ["El icono debe ser un texto válido"];
            }
            updates.icon = icon.trim();
        }
        if (restriccionModeloMonetizacion !== undefined) {
            if (restriccionModeloMonetizacion !== null &&
                !["COMISION_SUSCRIPCION", "SUSCRIPCION"].includes(restriccionModeloMonetizacion)) {
                return ["La restricción debe ser 'COMISION_SUSCRIPCION' o 'SUSCRIPCION'"];
            }
            updates.restriccionModeloMonetizacion = restriccionModeloMonetizacion;
        }
        if (statusCategoria !== undefined) {
            if (!Object.values(data_1.StatusCategoria).includes(statusCategoria)) {
                return ["Estado de categoría inválido"];
            }
            updates.statusCategoria = statusCategoria;
        }
        // Validación básica de cover si viene
        if (cover !== undefined && cover !== null) {
            if (typeof cover !== "object")
                return ["El campo cover debe ser un objeto o JSON válido"];
            if (cover.type && !["image", "video"].includes(cover.type)) {
                return ["El tipo de portada debe ser image o video"];
            }
        }
        return [
            undefined,
            new UpdateCategoriaDTO(updates.name, updates.icon, updates.restriccionModeloMonetizacion, soloComision === undefined ? undefined : !!soloComision, updates.statusCategoria, obj.orden !== undefined ? Number(obj.orden) : undefined, modeloBloqueado === undefined ? undefined : !!modeloBloqueado, modeloMonetizacionDefault, cover),
        ];
    }
}
exports.UpdateCategoriaDTO = UpdateCategoriaDTO;
