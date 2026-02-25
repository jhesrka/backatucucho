import { RestriccionModeloMonetizacion } from "../../../data"; // o donde esté el enum

export class CreateCategoriaDTO {
  private constructor(
    public readonly name: string,
    public readonly icon?: string,
    public readonly restriccionModeloMonetizacion?: RestriccionModeloMonetizacion,
    public readonly soloComision: boolean = false,
    public readonly orden: number = 0,
    public readonly modeloBloqueado: boolean = false,
    public readonly modeloMonetizacionDefault: string | null = null
  ) { }

  static create(obj: { [key: string]: any }): [string?, CreateCategoriaDTO?] {
    const { name, icon, restriccionModeloMonetizacion, soloComision, modeloBloqueado, modeloMonetizacionDefault } = obj;

    if (!name || typeof name !== "string" || name.trim().length < 3) {
      return ["El nombre de la categoría debe tener al menos 3 caracteres"];
    }

    if (
      restriccionModeloMonetizacion &&
      !["COMISION_SUSCRIPCION", "SUSCRIPCION"].includes(restriccionModeloMonetizacion)
    ) {
      return ["La restricción debe ser 'COMISION_SUSCRIPCION' o 'SUSCRIPCION'"];
    }

    return [
      undefined,
      new CreateCategoriaDTO(
        name.trim(),
        icon?.trim(),
        restriccionModeloMonetizacion,
        !!soloComision,
        obj.orden ? Number(obj.orden) : 0,
        !!modeloBloqueado,
        modeloMonetizacionDefault || null
      ),
    ];
  }
}
