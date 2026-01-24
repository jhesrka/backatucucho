import { regularExp } from "../../../config";

export class CreateProductoDTO {
  private constructor(
    public readonly nombre: string,
    public readonly descripcion: string,
    public readonly precio: number,
    public readonly precioParaApp: number | null,
    public readonly negocioId: string,
    public readonly modeloMonetizacion: "SUSCRIPCION" | "COMISION_SUSCRIPCION",
    public readonly tipoId: string
  ) { }

  static create(obj: {
    nombre: string;
    descripcion: string;
    precio: number;
    precioParaApp?: number;
    negocioId: string;
    modeloMonetizacion: "SUSCRIPCION" | "COMISION_SUSCRIPCION";
    tipoId?: string; // ya no es opcional en lógica, pero puede venir undefined desde el cliente
  }): [string?, CreateProductoDTO?] {
    const {
      nombre,
      descripcion,
      precio,
      precioParaApp,
      negocioId,
      modeloMonetizacion,
      tipoId,
    } = obj;

    if (!nombre || typeof nombre !== "string" || nombre.trim().length < 3) {
      return ["El nombre del producto debe tener al menos 3 caracteres"];
    }

    if (!descripcion || typeof descripcion !== "string" || descripcion.trim().length < 5) {
      return ["La descripción debe tener al menos 5 caracteres"];
    }

    if (isNaN(Number(precio)) || Number(precio) <= 0) {
      return ["El precio debe ser un número positivo"];
    }

    if (!negocioId || typeof negocioId !== "string" || !regularExp.uuid.test(negocioId)) {
      return ["El ID del negocio no es válido"];
    }

    if (!modeloMonetizacion || !["SUSCRIPCION", "COMISION_SUSCRIPCION"].includes(modeloMonetizacion)) {
      return ["Modelo de monetización inválido"];
    }

    if (modeloMonetizacion === "COMISION_SUSCRIPCION") {
      if (precioParaApp === undefined || precioParaApp === null) {
        return ["Debes proporcionar 'precioParaApp' para negocios con modelo COMISION + SUSCRIPCION"];
      }

      if (isNaN(Number(precioParaApp)) || Number(precioParaApp) <= 0) {
        return ["El precio para la app debe ser un número positivo"];
      }

      if (Number(precioParaApp) >= Number(precio)) {
        return ["El precio para la app debe ser menor que el precio normal"];
      }
    }

    if (!tipoId || typeof tipoId !== "string" || !regularExp.uuid.test(tipoId)) {
      return ["Debes seleccionar un tipo válido"];
    }

    return [
      undefined,
      new CreateProductoDTO(
        nombre.trim(),
        descripcion.trim(),
        Number(precio),
        modeloMonetizacion === "COMISION_SUSCRIPCION" ? Number(precioParaApp) : null,
        negocioId,
        modeloMonetizacion,
        tipoId.trim()
      ),
    ];
  }
}
