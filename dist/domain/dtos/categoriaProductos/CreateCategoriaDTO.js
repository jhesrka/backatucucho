"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateCategoriaDTO = void 0;
class CreateCategoriaDTO {
    constructor(name, icon, restriccionModeloMonetizacion, soloComision = false) {
        this.name = name;
        this.icon = icon;
        this.restriccionModeloMonetizacion = restriccionModeloMonetizacion;
        this.soloComision = soloComision;
    }
    static create(obj) {
        const { name, icon, restriccionModeloMonetizacion, soloComision } = obj;
        if (!name || typeof name !== "string" || name.trim().length < 3) {
            return ["El nombre de la categoría debe tener al menos 3 caracteres"];
        }
        if (!icon || typeof icon !== "string" || icon.trim().length === 0) {
            return ["El icono es obligatorio"];
        }
        if (restriccionModeloMonetizacion &&
            !["COMISION_SUSCRIPCION", "SUSCRIPCION"].includes(restriccionModeloMonetizacion)) {
            return ["La restricción debe ser 'COMISION_SUSCRIPCION' o 'SUSCRIPCION'"];
        }
        return [
            undefined,
            new CreateCategoriaDTO(name.trim(), icon.trim(), restriccionModeloMonetizacion, !!soloComision),
        ];
    }
}
exports.CreateCategoriaDTO = CreateCategoriaDTO;
