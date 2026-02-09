import { regularExp } from "../../../config";

export class CreateProductoDTO {
  private constructor(
    public readonly nombre: string,
    public readonly descripcion: string,
    public readonly precio_venta: number,
    public readonly precio_app: number | null,
    public readonly negocioId: string,
    public readonly modeloMonetizacion: "SUSCRIPCION" | "COMISION_SUSCRIPCION",
    public readonly tipoId: string
  ) { }

  static create(obj: {
    nombre: string;
    descripcion: string;
    precio_venta: number;
    precio_app?: number;
    negocioId: string;
    modeloMonetizacion: "SUSCRIPCION" | "COMISION_SUSCRIPCION";
    tipoId?: string; // ya no es opcional en lógica, pero puede venir undefined desde el cliente
  }): [string?, CreateProductoDTO?] {
    const {
      nombre,
      descripcion,
      precio_venta,
      precio_app,
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

    if (isNaN(Number(precio_venta)) || Number(precio_venta) <= 0) {
      return ["El precio de venta debe ser un número positivo"];
    }

    if (!negocioId || typeof negocioId !== "string" || !regularExp.uuid.test(negocioId)) {
      return ["El ID del negocio no es válido"];
    }

    if (!modeloMonetizacion || !["SUSCRIPCION", "COMISION_SUSCRIPCION"].includes(modeloMonetizacion)) {
      return ["Modelo de monetización inválido"];
    }

    if (modeloMonetizacion === "COMISION_SUSCRIPCION") {
      if (precio_app === undefined || precio_app === null) {
        return ["Debes proporcionar 'precio_app' para negocios con modelo COMISION + SUSCRIPCION"];
      }

      if (isNaN(Number(precio_app)) || Number(precio_app) <= 0) {
        return ["El precio para la app debe ser un número positivo"];
      }

      if (Number(precio_app) >= Number(precio_venta)) {
        return ["El precio para la app debe ser menor que el precio de venta"];
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
        Number(precio_venta),
        modeloMonetizacion === "COMISION_SUSCRIPCION" ? Number(precio_app) : Number(precio_venta),
        negocioId,
        modeloMonetizacion,
        tipoId.trim()
      ),
    ];
  }
}
