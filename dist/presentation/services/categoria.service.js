"use strict";
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
exports.CategoriaService = void 0;
const data_1 = require("../../data");
const domain_1 = require("../../domain");
class CategoriaService {
    // Crear categoría
    createCategoria(dto) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            const categoria = data_1.CategoriaNegocio.create({
                nombre: dto.name,
                icono: dto.icon,
                restriccionModeloMonetizacion: (_a = dto.restriccionModeloMonetizacion) !== null && _a !== void 0 ? _a : null,
                soloComision: (_b = dto.soloComision) !== null && _b !== void 0 ? _b : false,
            });
            try {
                return yield categoria.save();
            }
            catch (_c) {
                throw domain_1.CustomError.internalServer("No se pudo guardar la categoría");
            }
        });
    }
    // Obtener todas las categorías
    getAllCategorias() {
        return __awaiter(this, void 0, void 0, function* () {
            return yield data_1.CategoriaNegocio.find({
                order: { created_at: "ASC" },
            });
        });
    }
    // Obtener categoría por ID
    getCategoriaById(id) {
        return __awaiter(this, void 0, void 0, function* () {
            const categoria = yield data_1.CategoriaNegocio.findOneBy({ id });
            if (!categoria)
                throw domain_1.CustomError.notFound("Categoría no encontrada");
            return categoria;
        });
    }
    // Actualizar categoría
    updateCategoria(id, dto) {
        return __awaiter(this, void 0, void 0, function* () {
            const categoria = yield this.getCategoriaById(id);
            if (dto.name)
                categoria.nombre = dto.name;
            if (dto.icon)
                categoria.icono = dto.icon;
            if (dto.restriccionModeloMonetizacion !== undefined) {
                categoria.restriccionModeloMonetizacion =
                    dto.restriccionModeloMonetizacion;
            }
            if (dto.soloComision !== undefined) {
                categoria.soloComision = dto.soloComision;
            }
            if (dto.statusCategoria !== undefined) {
                categoria.statusCategoria = dto.statusCategoria;
            }
            try {
                return yield categoria.save();
            }
            catch (_a) {
                throw domain_1.CustomError.internalServer("No se pudo actualizar la categoría");
            }
        });
    }
    // Eliminar categoría
    deleteCategoria(id) {
        return __awaiter(this, void 0, void 0, function* () {
            const categoria = yield this.getCategoriaById(id);
            try {
                return yield categoria.remove();
            }
            catch (_a) {
                throw domain_1.CustomError.internalServer("No se pudo eliminar la categoría");
            }
        });
    }
}
exports.CategoriaService = CategoriaService;
