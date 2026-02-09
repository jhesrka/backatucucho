"use strict";
// src/services/TipoProductoService.ts
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TipoProductoService = void 0;
const data_1 = require("../../data");
const domain_1 = require("../../domain");
class TipoProductoService {
    // ========================= CREATE =========================
    createTipoProducto(nombre, negocioId) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!nombre || nombre.trim().length < 3)
                throw domain_1.CustomError.badRequest("El nombre del tipo debe tener al menos 3 caracteres");
            const negocio = yield data_1.Negocio.findOneBy({ id: negocioId });
            if (!negocio)
                throw domain_1.CustomError.notFound("Negocio no encontrado");
            const existing = yield data_1.TipoProducto.findOneBy({
                nombre: nombre.trim(),
                negocio: { id: negocioId },
            });
            if (existing)
                throw domain_1.CustomError.badRequest("Este tipo de producto ya existe para este negocio");
            const tipo = data_1.TipoProducto.create({
                nombre: nombre.trim(),
                negocio,
            });
            try {
                return yield tipo.save();
            }
            catch (err) {
                console.error("❌ Error exacto:", err);
                throw domain_1.CustomError.internalServer("Error guardando el tipo de producto");
            }
        });
    }
    // ========================= READ =========================
    // 🔒 Solo devuelve los tipos del negocio indicado
    getTiposByNegocio(negocioId) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!negocioId)
                throw domain_1.CustomError.badRequest("Falta el ID del negocio");
            const tipos = yield data_1.TipoProducto.find({
                where: { negocio: { id: negocioId } },
                order: { nombre: "ASC" },
                relations: ["negocio"],
            });
            return tipos;
        });
    }
    // ========================= DELETE =========================
    deleteTipo(id) {
        return __awaiter(this, void 0, void 0, function* () {
            const tipo = yield data_1.TipoProducto.findOneBy({ id });
            if (!tipo) {
                throw domain_1.CustomError.notFound("Tipo de producto no encontrado");
            }
            try {
                yield data_1.TipoProducto.remove(tipo);
                return { message: "Tipo de producto eliminado correctamente" };
            }
            catch (_a) {
                throw domain_1.CustomError.internalServer("No se pudo eliminar el tipo de producto");
            }
        });
    }
}
exports.TipoProductoService = TipoProductoService;
