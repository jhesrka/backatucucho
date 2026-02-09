import { regularExp } from "../../../config";

export class UpdateProductoDTO {
  private constructor(
    public readonly nombre?: string,
    public readonly descripcion?: string,
    public readonly precio_venta?: number,
    public readonly precio_app?: number | null,
    public readonly tipoId?: string,
    public readonly modeloMonetizacion?: "SUSCRIPCION" | "COMISION_SUSCRIPCION"
  ) { }

  static create(obj: {
    nombre?: string;
    descripcion?: string;
    precio_venta?: number;
    precio_app?: number;
    tipoId?: string;
    modeloMonetizacion?: "SUSCRIPCION" | "COMISION_SUSCRIPCION";
  }): [string?, UpdateProductoDTO?] {
    const {
      nombre,
      descripcion,
      precio_venta,
      precio_app,
      tipoId,
      modeloMonetizacion,
    } = obj;

    if (nombre && (typeof nombre !== "string" || nombre.trim().length < 3)) {
      return ["El nombre debe tener al menos 3 caracteres"];
    }

    if (descripcion && (typeof descripcion !== "string" || descripcion.trim().length < 5)) {
      return ["La descripción debe tener al menos 5 caracteres"];
    }

    if (precio_venta !== undefined && (isNaN(Number(precio_venta)) || Number(precio_venta) <= 0)) {
      return ["El precio de venta debe ser un número positivo"];
    }

    if (modeloMonetizacion && !["SUSCRIPCION", "COMISION_SUSCRIPCION"].includes(modeloMonetizacion)) {
      return ["Modelo de monetización inválido"];
    }

    if (precio_app !== undefined && (isNaN(Number(precio_app)) || Number(precio_app) <= 0)) {
      return ["El precio para la app debe ser un número positivo"];
    }

    if (
      modeloMonetizacion === "COMISION_SUSCRIPCION" &&
      precio_app !== undefined &&
      precio_venta !== undefined &&
      Number(precio_app) >= Number(precio_venta)
    ) {
      return ["El precio para la app debe ser menor que el precio de venta"];
    }

    if (tipoId && !regularExp.uuid.test(tipoId)) {
      return ["El tipoId no es un UUID válido"];
    }

    return [
      undefined,
      new UpdateProductoDTO(
        nombre?.trim(),
        descripcion?.trim(),
        precio_venta !== undefined ? Number(precio_venta) : undefined,
        precio_app !== undefined ? Number(precio_app) : undefined,
        tipoId?.trim(),
        modeloMonetizacion
      ),
    ];
  }
}
