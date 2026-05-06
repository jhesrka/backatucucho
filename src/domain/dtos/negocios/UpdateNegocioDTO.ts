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
    public readonly porcentaje_recargo_tarjeta?: number,
    public readonly subcategoriaId?: string | null,
    public readonly tiempoPreparacionMin?: number,
    public readonly tiempoPreparacionMax?: number,
    public readonly permiteProductosProgramados?: boolean,
    public readonly tiempoProgramadoMin?: number | null,
    public readonly tiempoProgramadoMax?: number | null
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
      porcentaje_recargo_tarjeta,
      subcategoriaId,
      tiempoPreparacionMin,
      tiempoPreparacionMax,
      permiteProductosProgramados,
      tiempoProgramadoMin,
      tiempoProgramadoMax
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
      if (isNaN(recargo) || recargo < 0 || recargo > 20) {
        return ["El porcentaje de recargo debe estar entre 0% y 20% (máximo recomendado)"];
      }
    }

    // Validar Tiempos (si vienen)
    if (tiempoPreparacionMin !== undefined) {
      if (isNaN(Number(tiempoPreparacionMin)) || Number(tiempoPreparacionMin) <= 0) return ["tiempoPreparacionMin debe ser un número positivo"];
    }
    if (tiempoPreparacionMax !== undefined) {
      if (isNaN(Number(tiempoPreparacionMax)) || Number(tiempoPreparacionMax) <= 0) return ["tiempoPreparacionMax debe ser un número positivo"];
    }
    if (tiempoPreparacionMin !== undefined && tiempoPreparacionMax !== undefined) {
      if (Number(tiempoPreparacionMin) >= Number(tiempoPreparacionMax)) return ["tiempoPreparacionMin debe ser menor que tiempoPreparacionMax"];
    }

    if (tiempoProgramadoMin !== undefined && tiempoProgramadoMin !== null) {
      if (isNaN(Number(tiempoProgramadoMin)) || Number(tiempoProgramadoMin) <= 0) return ["tiempoProgramadoMin debe ser un número positivo"];
    }
    if (tiempoProgramadoMax !== undefined && tiempoProgramadoMax !== null) {
      if (isNaN(Number(tiempoProgramadoMax)) || Number(tiempoProgramadoMax) <= 0) return ["tiempoProgramadoMax debe ser un número positivo"];
    }
    if (tiempoProgramadoMin !== undefined && tiempoProgramadoMin !== null && tiempoProgramadoMax !== undefined && tiempoProgramadoMax !== null) {
      if (Number(tiempoProgramadoMin) >= Number(tiempoProgramadoMax)) return ["tiempoProgramadoMin debe ser menor que tiempoProgramadoMax"];
    }

    if (subcategoriaId !== undefined && subcategoriaId !== null && !regularExp.uuid.test(subcategoriaId)) {
      return ["El ID de subcategoría no es válido"];
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
        porcentaje_recargo_tarjeta !== undefined ? Number(porcentaje_recargo_tarjeta) : undefined,
        subcategoriaId,
        tiempoPreparacionMin !== undefined ? Number(tiempoPreparacionMin) : undefined,
        tiempoPreparacionMax !== undefined ? Number(tiempoPreparacionMax) : undefined,
        permiteProductosProgramados !== undefined ? !!permiteProductosProgramados : undefined,
        tiempoProgramadoMin !== undefined && tiempoProgramadoMin !== null ? Number(tiempoProgramadoMin) : (tiempoProgramadoMin === null ? null : undefined),
        tiempoProgramadoMax !== undefined && tiempoProgramadoMax !== null ? Number(tiempoProgramadoMax) : (tiempoProgramadoMax === null ? null : undefined)
      ),
    ];
  }
}
