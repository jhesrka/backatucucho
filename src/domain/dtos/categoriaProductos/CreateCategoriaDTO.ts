import { RestriccionModeloMonetizacion } from "../../../data"; // o donde esté el enum

export class CreateCategoriaDTO {
  private constructor(
    public readonly name: string,
    public readonly icon: string,
    public readonly restriccionModeloMonetizacion?: RestriccionModeloMonetizacion,
    public readonly soloComision: boolean = false
  ) {}

  static create(obj: { [key: string]: any }): [string?, CreateCategoriaDTO?] {
    const { name, icon, restriccionModeloMonetizacion, soloComision } = obj;

    if (!name || typeof name !== "string" || name.trim().length < 3) {
      return ["El nombre de la categoría debe tener al menos 3 caracteres"];
    }

    if (!icon || typeof icon !== "string" || icon.trim().length === 0) {
      return ["El icono es obligatorio"];
    }

    if (
      restriccionModeloMonetizacion &&
      !["COMISION", "SUSCRIPCION"].includes(restriccionModeloMonetizacion)
    ) {
      return ["La restricción debe ser 'COMISION' o 'SUSCRIPCION'"];
    }

    return [
      undefined,
      new CreateCategoriaDTO(
        name.trim(),
        icon.trim(),
        restriccionModeloMonetizacion,
        !!soloComision
      ),
    ];
  }
}
