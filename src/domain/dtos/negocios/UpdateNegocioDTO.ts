// src/domain/dtos/negocios/UpdateNegocioDTO.ts
import { regularExp } from "../../../config";
import { StatusNegocio, ModeloMonetizacion } from "../../../data";

export class UpdateNegocioDTO {
  private constructor(
    public readonly nombre?: string,
    public readonly descripcion?: string,
    public readonly categoriaId?: string,
    public readonly statusNegocio?: StatusNegocio,
    public readonly modeloMonetizacion?: ModeloMonetizacion,
    public readonly latitud?: number,
    public readonly longitud?: number,
    public readonly direccionTexto?: string | null,
    public readonly valorSuscripcion?: number,
    public readonly diaPago?: number,
    public readonly masterPin?: string,
    public readonly orden?: number,
    public readonly pago_tarjeta_habilitado_admin?: boolean,
    public readonly pago_tarjeta_activo_negocio?: boolean,
    public readonly payphone_store_id?: string | null,
    public readonly payphone_token?: string | null,
    public readonly porcentaje_recargo_tarjeta?: number
  ) { }

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
      valorSuscripcion,
      diaPago,
      orden,
      pago_tarjeta_habilitado_admin,
      pago_tarjeta_activo_negocio,
      payphone_store_id,
      payphone_token,
      porcentaje_recargo_tarjeta
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
      !Object.values(ModeloMonetizacion).includes(modeloMonetizacion)
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

    if (valorSuscripcion !== undefined) {
      const val = Number(valorSuscripcion);
      if (isNaN(val) || val < 0) {
        return ["El valor de suscripción debe ser un número positivo"];
      }
    }

    if (diaPago !== undefined) {
      const dia = Number(diaPago);
      if (isNaN(dia) || dia < 1 || dia > 31) {
        return ["El día de pago debe ser entre 1 y 31"];
      }
    }

    if (orden !== undefined) {
      const ord = Number(orden);
      if (isNaN(ord)) {
        return ["El orden debe ser un número"];
      }
    }

    if (porcentaje_recargo_tarjeta !== undefined) {
      const recargo = Number(porcentaje_recargo_tarjeta);
      if (isNaN(recargo) || recargo < 0 || recargo > 100) {
        return ["El porcentaje de recargo debe estar entre 0 y 100"];
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
        modeloMonetizacion,
        latitud !== undefined ? Number(latitud) : undefined,
        longitud !== undefined ? Number(longitud) : undefined,
        dirTxt,
        valorSuscripcion !== undefined ? Number(valorSuscripcion) : undefined,
        diaPago !== undefined ? Number(diaPago) : undefined,
        obj.masterPin,
        orden !== undefined ? Number(orden) : undefined,
        pago_tarjeta_habilitado_admin,
        pago_tarjeta_activo_negocio,
        payphone_store_id,
        payphone_token,
        porcentaje_recargo_tarjeta !== undefined ? Number(porcentaje_recargo_tarjeta) : undefined
      ),
    ];
  }
}
