"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateCategoriaDTO = void 0;
class CreateCategoriaDTO {
    constructor(name, icon, restriccionModeloMonetizacion, soloComision = false, orden = 0, modeloBloqueado = false, modeloMonetizacionDefault = null) {
        this.name = name;
        this.icon = icon;
        this.restriccionModeloMonetizacion = restriccionModeloMonetizacion;
        this.soloComision = soloComision;
        this.orden = orden;
        this.modeloBloqueado = modeloBloqueado;
        this.modeloMonetizacionDefault = modeloMonetizacionDefault;
    }
    static create(obj) {
        const { name, icon, restriccionModeloMonetizacion, soloComision, modeloBloqueado, modeloMonetizacionDefault } = obj;
        if (!name || typeof name !== "string" || name.trim().length < 3) {
            return ["El nombre de la categoría debe tener al menos 3 caracteres"];
        }
        if (restriccionModeloMonetizacion &&
            !["COMISION_SUSCRIPCION", "SUSCRIPCION"].includes(restriccionModeloMonetizacion)) {
            return ["La restricción debe ser 'COMISION_SUSCRIPCION' o 'SUSCRIPCION'"];
        }
        return [
            undefined,
            new CreateCategoriaDTO(name.trim(), icon === null || icon === void 0 ? void 0 : icon.trim(), restriccionModeloMonetizacion, !!soloComision, obj.orden ? Number(obj.orden) : 0, !!modeloBloqueado, modeloMonetizacionDefault || null),
        ];
    }
}
exports.CreateCategoriaDTO = CreateCategoriaDTO;
