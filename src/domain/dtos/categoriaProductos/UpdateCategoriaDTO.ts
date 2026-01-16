import { RestriccionModeloMonetizacion } from "../../../data";

export class UpdateCategoriaDTO {
  private constructor(
    public readonly name?: string,
    public readonly icon?: string,
    public readonly restriccionModeloMonetizacion?: RestriccionModeloMonetizacion,
    public readonly soloComision?: boolean
  ) {}

  static create(obj: { [key: string]: any }): [string?, UpdateCategoriaDTO?] {
    const { name, icon, restriccionModeloMonetizacion, soloComision } = obj;

    if (!name && !icon && !restriccionModeloMonetizacion) {
      return [
        "Debes enviar al menos 'name', 'icon' o 'restriccionModeloMonetizacion'",
      ];
    }

    const updates: {
      name?: string;
      icon?: string;
      restriccionModeloMonetizacion?: RestriccionModeloMonetizacion;
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
        !["COMISION", "SUSCRIPCION"].includes(restriccionModeloMonetizacion)
      ) {
        return ["La restricción debe ser 'COMISION' o 'SUSCRIPCION'"];
      }
      updates.restriccionModeloMonetizacion = restriccionModeloMonetizacion;
    }

    return [
      undefined,
      new UpdateCategoriaDTO(
        updates.name,
        updates.icon,
        updates.restriccionModeloMonetizacion,
        soloComision === undefined ? undefined : !!soloComision
      ),
    ];
  }
}
