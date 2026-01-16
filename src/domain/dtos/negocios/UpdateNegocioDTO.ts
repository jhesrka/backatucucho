// src/domain/dtos/negocios/UpdateNegocioDTO.ts
import { regularExp } from "../../../config";
import { StatusNegocio, ModeloMonetizacion } from "../../../data";

export class UpdateNegocioDTO {
  private constructor(
    public readonly nombre?: string,
    public readonly descripcion?: string,
    public readonly categoriaId?: string,
    public readonly statusNegocio?: StatusNegocio,
    public readonly modeloMonetizacion?: "COMISION" | "SUSCRIPCION",
    public readonly latitud?: number,
    public readonly longitud?: number,
    public readonly direccionTexto?: string | null
  ) {}

  static create(obj: { [key: string]: any }): [string?, UpdateNegocioDTO?] {
    const {
      nombre,
      descripcion,
      categoriaId,
      statusNegocio,
      modeloMonetizacion,
      latitud,
      longitud,
      direccionTexto,
    } = obj;

    // Validaciones opcionales
    if (nombre !== undefined && (typeof nombre !== "string" || nombre.trim().length < 3)) {
      return ["El nombre del negocio debe tener al menos 3 caracteres"];
    }

    if (descripcion !== undefined && (typeof descripcion !== "string" || descripcion.trim().length < 10)) {
      return ["La descripción debe tener al menos 10 caracteres"];
    }

    if (categoriaId !== undefined && (!regularExp.uuid.test(categoriaId))) {
      return ["El ID de categoría no es válido"];
    }

    if (statusNegocio !== undefined && !Object.values(StatusNegocio).includes(statusNegocio)) {
      return ["Estado de negocio inválido"];
    }

    if (
      modeloMonetizacion !== undefined &&
      !["COMISION", "SUSCRIPCION"].includes(modeloMonetizacion)
    ) {
      return ["Debes seleccionar un modelo de monetización válido"];
    }

    if (latitud !== undefined) {
      const lat = Number(latitud);
      if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
        return ["Latitud inválida"];
      }
    }

    if (longitud !== undefined) {
      const lng = Number(longitud);
      if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
        return ["Longitud inválida"];
      }
    }

    const dirTxt =
      typeof direccionTexto === "string" && direccionTexto.trim().length > 0
        ? direccionTexto.trim().slice(0, 200)
        : undefined;

    return [
      undefined,
      new UpdateNegocioDTO(
        nombre?.trim(),
        descripcion?.trim(),
        categoriaId,
        statusNegocio,
        modeloMonetizacion as "COMISION" | "SUSCRIPCION",
        latitud !== undefined ? Number(latitud) : undefined,
        longitud !== undefined ? Number(longitud) : undefined,
        dirTxt
      ),
    ];
  }
}
