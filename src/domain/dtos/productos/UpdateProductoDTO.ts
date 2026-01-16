import { regularExp } from "../../../config";

export class UpdateProductoDTO {
  private constructor(
    public readonly nombre?: string,
    public readonly descripcion?: string,
    public readonly precio?: number,
    public readonly precioParaApp?: number | null,
    public readonly tipoId?: string,
    public readonly modeloMonetizacion?: "COMISION" | "SUSCRIPCION"
  ) {}

  static create(obj: {
    nombre?: string;
    descripcion?: string;
    precio?: number;
    precioParaApp?: number;
    tipoId?: string;
    modeloMonetizacion?: "COMISION" | "SUSCRIPCION";
  }): [string?, UpdateProductoDTO?] {
    const {
      nombre,
      descripcion,
      precio,
      precioParaApp,
      tipoId,
      modeloMonetizacion,
    } = obj;

    if (nombre && (typeof nombre !== "string" || nombre.trim().length < 3)) {
      return ["El nombre debe tener al menos 3 caracteres"];
    }

    if (descripcion && (typeof descripcion !== "string" || descripcion.trim().length < 5)) {
      return ["La descripción debe tener al menos 5 caracteres"];
    }

    if (precio !== undefined && (isNaN(Number(precio)) || Number(precio) <= 0)) {
      return ["El precio debe ser un número positivo"];
    }

    if (modeloMonetizacion && !["COMISION", "SUSCRIPCION"].includes(modeloMonetizacion)) {
      return ["Modelo de monetización inválido"];
    }

    if (precioParaApp !== undefined && (isNaN(Number(precioParaApp)) || Number(precioParaApp) <= 0)) {
      return ["El precio para la app debe ser un número positivo"];
    }

    if (
      modeloMonetizacion === "COMISION" &&
      precioParaApp !== undefined &&
      precio !== undefined &&
      Number(precioParaApp) >= Number(precio)
    ) {
      return ["El precio para la app debe ser menor que el precio normal"];
    }

    if (tipoId && !regularExp.uuid.test(tipoId)) {
      return ["El tipoId no es un UUID válido"];
    }

    return [
      undefined,
      new UpdateProductoDTO(
        nombre?.trim(),
        descripcion?.trim(),
        precio !== undefined ? Number(precio) : undefined,
        precioParaApp !== undefined ? Number(precioParaApp) : undefined,
        tipoId?.trim(),
        modeloMonetizacion
      ),
    ];
  }
}
