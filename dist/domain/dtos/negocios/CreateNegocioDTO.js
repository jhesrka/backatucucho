"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateNegocioDTO = void 0;
const config_1 = require("../../../config");
const data_1 = require("../../../data");
class CreateNegocioDTO {
    constructor(nombre, descripcion, categoriaId, userId, modeloMonetizacion, latitud, longitud, banco, tipoCuenta, numeroCuenta, titularCuenta, identificacionCuenta, correoCuenta, tiempoPreparacionMin, tiempoPreparacionMax, permiteProductosProgramados = false, tiempoProgramadoMin, tiempoProgramadoMax, subcategoriaId, direccionTexto, valorSuscripcion = 0, diaPago = 1, orden = 0) {
        this.nombre = nombre;
        this.descripcion = descripcion;
        this.categoriaId = categoriaId;
        this.userId = userId;
        this.modeloMonetizacion = modeloMonetizacion;
        this.latitud = latitud;
        this.longitud = longitud;
        this.banco = banco;
        this.tipoCuenta = tipoCuenta;
        this.numeroCuenta = numeroCuenta;
        this.titularCuenta = titularCuenta;
        this.identificacionCuenta = identificacionCuenta;
        this.correoCuenta = correoCuenta;
        this.tiempoPreparacionMin = tiempoPreparacionMin;
        this.tiempoPreparacionMax = tiempoPreparacionMax;
        this.permiteProductosProgramados = permiteProductosProgramados;
        this.tiempoProgramadoMin = tiempoProgramadoMin;
        this.tiempoProgramadoMax = tiempoProgramadoMax;
        this.subcategoriaId = subcategoriaId;
        this.direccionTexto = direccionTexto;
        this.valorSuscripcion = valorSuscripcion;
        this.diaPago = diaPago;
        this.orden = orden;
    }
    static create(obj) {
        const { nombre, descripcion, categoriaId, userId, modeloMonetizacion, latitud, longitud, direccionTexto, banco, tipoCuenta, numeroCuenta, titularCuenta, identificacionCuenta, correoCuenta, tiempoPreparacionMin, tiempoPreparacionMax, permiteProductosProgramados, tiempoProgramadoMin, tiempoProgramadoMax, subcategoriaId, valorSuscripcion, diaPago, orden } = obj;
        if (!nombre || typeof nombre !== "string" || nombre.trim().length < 3) {
            return ["El nombre del negocio debe tener al menos 3 caracteres"];
        }
        if (!descripcion || typeof descripcion !== "string" || descripcion.trim().length < 10) {
            return ["La descripción debe tener al menos 10 caracteres"];
        }
        if (!categoriaId || typeof categoriaId !== "string" || !config_1.regularExp.uuid.test(categoriaId)) {
            return ["El ID de categoría no es válido"];
        }
        if (!userId || typeof userId !== "string" || !config_1.regularExp.uuid.test(userId)) {
            return ["El ID de usuario no es válido"];
        }
        if (!modeloMonetizacion || !Object.values(data_1.ModeloMonetizacion).includes(modeloMonetizacion)) {
            return ["Debes seleccionar un modelo de monetización válido"];
        }
        // Validar Datos Bancarios
        if (!banco || typeof banco !== "string" || banco.trim().length < 2) {
            return ["El nombre del banco es obligatorio"];
        }
        if (!tipoCuenta || typeof tipoCuenta !== "string" || tipoCuenta.trim().length < 2) {
            return ["El tipo de cuenta es obligatorio"];
        }
        if (!numeroCuenta || typeof numeroCuenta !== "string" || numeroCuenta.trim().length < 5) {
            return ["El número de cuenta es obligatorio"];
        }
        if (!titularCuenta || typeof titularCuenta !== "string" || titularCuenta.trim().length < 3) {
            return ["El titular de la cuenta es obligatorio"];
        }
        if (!identificacionCuenta || typeof identificacionCuenta !== "string" || identificacionCuenta.trim().length < 5) {
            return ["La identificación (Cédula/RUC) es obligatoria"];
        }
        if (!correoCuenta || typeof correoCuenta !== "string" || correoCuenta.trim().length < 5) {
            return ["El correo de la cuenta es obligatorio"];
        }
        // Validar Tiempos de Preparación
        const tMin = Number(tiempoPreparacionMin);
        const tMax = Number(tiempoPreparacionMax);
        if (isNaN(tMin) || tMin <= 0)
            return ["tiempoPreparacionMin debe ser un número positivo"];
        if (isNaN(tMax) || tMax <= 0)
            return ["tiempoPreparacionMax debe ser un número positivo"];
        if (tMin >= tMax)
            return ["tiempoPreparacionMin debe ser menor que tiempoPreparacionMax"];
        // Validar Tiempos Programados (si están habilitados)
        const pEnabled = !!permiteProductosProgramados;
        let tpMin = undefined;
        let tpMax = undefined;
        if (pEnabled) {
            tpMin = Number(tiempoProgramadoMin);
            tpMax = Number(tiempoProgramadoMax);
            if (isNaN(tpMin) || tpMin <= 0)
                return ["tiempoProgramadoMin debe ser un número positivo"];
            if (isNaN(tpMax) || tpMax <= 0)
                return ["tiempoProgramadoMax debe ser un número positivo"];
            if (tpMin >= tpMax)
                return ["tiempoProgramadoMin debe ser menor que tiempoProgramadoMax"];
        }
        // ✅ Ubicación obligatoria para crear
        const lat = Number(latitud);
        const lng = Number(longitud);
        if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
            return ["Latitud inválida"];
        }
        if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
            return ["Longitud inválida"];
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
        // opcional, pero si viene validamos tamaño
        const dirTxt = typeof direccionTexto === "string" && direccionTexto.trim().length > 0
            ? direccionTexto.trim().slice(0, 200)
            : undefined;
        if (subcategoriaId && !config_1.regularExp.uuid.test(subcategoriaId)) {
            return ["El ID de subcategoría no es válido"];
        }
        return [
            undefined,
            new CreateNegocioDTO(nombre.trim(), descripcion.trim(), categoriaId, userId, modeloMonetizacion, lat, lng, banco.trim(), tipoCuenta.trim(), numeroCuenta.trim(), titularCuenta.trim(), identificacionCuenta.trim(), correoCuenta.trim(), tMin, tMax, pEnabled, tpMin, tpMax, subcategoriaId, dirTxt, valorSuscripcion !== undefined ? Number(valorSuscripcion) : 0, diaPago !== undefined ? Number(diaPago) : 1, orden !== undefined ? Number(orden) : 0),
        ];
    }
}
exports.CreateNegocioDTO = CreateNegocioDTO;
