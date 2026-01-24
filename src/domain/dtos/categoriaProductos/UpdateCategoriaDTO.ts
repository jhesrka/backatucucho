import { RestriccionModeloMonetizacion, StatusCategoria } from "../../../data";

export class UpdateCategoriaDTO {
  private constructor(
    public readonly name?: string,
    public readonly icon?: string,
    public readonly restriccionModeloMonetizacion?: RestriccionModeloMonetizacion,
    public readonly soloComision?: boolean,
    public readonly statusCategoria?: StatusCategoria
  ) { }

  static create(obj: { [key: string]: any }): [string?, UpdateCategoriaDTO?] {
    const { name, icon, restriccionModeloMonetizacion, soloComision, statusCategoria } = obj;

    if (!name && !icon && !restriccionModeloMonetizacion && statusCategoria === undefined && soloComision === undefined) {
      return [
        "Debes enviar al menos un campo para actualizar",
      ];
    }

    const updates: {
      name?: string;
      icon?: string;
      restriccionModeloMonetizacion?: RestriccionModeloMonetizacion;
      statusCategoria?: StatusCategoria;
    } = {};

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
      if (
        restriccionModeloMonetizacion !== null &&
        !["COMISION_SUSCRIPCION", "SUSCRIPCION"].includes(restriccionModeloMonetizacion)
      ) {
        return ["La restricción debe ser 'COMISION_SUSCRIPCION' o 'SUSCRIPCION'"];
      }
      updates.restriccionModeloMonetizacion = restriccionModeloMonetizacion;
    }

    if (statusCategoria !== undefined) {
      if (!Object.values(StatusCategoria).includes(statusCategoria)) {
        return ["Estado de categoría inválido"];
      }
      updates.statusCategoria = statusCategoria;
    }

    return [
      undefined,
      new UpdateCategoriaDTO(
        updates.name,
        updates.icon,
        updates.restriccionModeloMonetizacion,
        soloComision === undefined ? undefined : !!soloComision,
        updates.statusCategoria
      ),
    ];
  }
}
