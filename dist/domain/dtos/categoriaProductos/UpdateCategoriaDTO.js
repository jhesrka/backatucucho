"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateCategoriaDTO = void 0;
const data_1 = require("../../../data");
class UpdateCategoriaDTO {
    constructor(name, icon, restriccionModeloMonetizacion, soloComision, statusCategoria) {
        this.name = name;
        this.icon = icon;
        this.restriccionModeloMonetizacion = restriccionModeloMonetizacion;
        this.soloComision = soloComision;
        this.statusCategoria = statusCategoria;
    }
    static create(obj) {
        const { name, icon, restriccionModeloMonetizacion, soloComision, statusCategoria } = obj;
        if (!name && !icon && !restriccionModeloMonetizacion && statusCategoria === undefined && soloComision === undefined) {
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
            if (typeof icon !== "string" || icon.trim().length === 0) {
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
        return [
            undefined,
            new UpdateCategoriaDTO(updates.name, updates.icon, updates.restriccionModeloMonetizacion, soloComision === undefined ? undefined : !!soloComision, updates.statusCategoria),
        ];
    }
}
exports.UpdateCategoriaDTO = UpdateCategoriaDTO;
