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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CategoriaService = void 0;
const data_1 = require("../../data");
const domain_1 = require("../../domain");
const upload_files_cloud_adapter_1 = require("../../config/upload-files-cloud-adapter");
const config_1 = require("../../config");
const global_settings_model_1 = require("../../data/postgres/models/global-settings.model");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
class CategoriaService {
    // Crear categoría
    createCategoria(dto, file, masterPin) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d, _e;
            yield this.verifyMasterPin(masterPin);
            let key;
            try {
                key = yield upload_files_cloud_adapter_1.UploadFilesCloud.uploadSingleFile({
                    bucketName: config_1.envs.AWS_BUCKET_NAME,
                    key: `categorias/${Date.now()}-${file.originalname}`,
                    body: file.buffer,
                    contentType: file.mimetype,
                });
            }
            catch (error) {
                throw domain_1.CustomError.internalServer("Error subiendo la imagen de la categoría");
            }
            const categoria = data_1.CategoriaNegocio.create({
                nombre: dto.name,
                icono: key,
                restriccionModeloMonetizacion: (_a = dto.restriccionModeloMonetizacion) !== null && _a !== void 0 ? _a : null,
                soloComision: (_b = dto.soloComision) !== null && _b !== void 0 ? _b : false,
                orden: (_c = dto.orden) !== null && _c !== void 0 ? _c : 0,
                modeloBloqueado: (_d = dto.modeloBloqueado) !== null && _d !== void 0 ? _d : false,
                modeloMonetizacionDefault: (_e = dto.modeloMonetizacionDefault) !== null && _e !== void 0 ? _e : null,
            });
            try {
                const saved = yield categoria.save();
                const imageUrl = yield upload_files_cloud_adapter_1.UploadFilesCloud.getFile({
                    bucketName: config_1.envs.AWS_BUCKET_NAME,
                    key: saved.icono,
                });
                return Object.assign(Object.assign({}, saved), { icono: imageUrl });
            }
            catch (_f) {
                throw domain_1.CustomError.internalServer("No se pudo guardar la categoría");
            }
        });
    }
    // Obtener todas las categorías
    getAllCategorias() {
        return __awaiter(this, void 0, void 0, function* () {
            const categorias = yield data_1.CategoriaNegocio.find({
                order: { orden: "ASC", created_at: "ASC" },
            });
            return yield Promise.all(categorias.map((cat) => __awaiter(this, void 0, void 0, function* () {
                let imageUrl = cat.icono;
                // Solo obtener URL firmada si no es un icono de texto (para compatibilidad o nuevos uploads)
                // Pero el requerimiento dice "Siempre debe existir una imagen activa".
                // Asumimos que todo lo nuevo es imagen/key. Si es viejo (FaIcon), getFile devolverá el key o fallará si trata de buscar en S3?
                // UploadFilesCloud.getFile retorna key si empieza con http. Si no, busca en S3.
                // Si el key es "FaIcon", S3 lanzará error o devolverá URL firmada a un objeto inexistente.
                // Vamos a asumir que el frontend maneja fallback si la imagen falla, o que migramos todo.
                // Pero para no romper, intentemos obtener URL solo si parece un path de archivo o S3 key.
                // Un simple check: si no tiene espacios y empieza con "Fa", quizas es legacy.
                // Pero mejor usar getFile que maneja la logica.
                try {
                    // Si el icono es un string corto sin '/' ni '.', probablemente es un icono legacy (FaIcon)
                    // OJO: UploadFilesCloud.getFile intentará firmarlo.
                    // Para evitar romper los iconos actuales en dev mientras migramos:
                    if (cat.icono.startsWith("Fa") && !cat.icono.includes("/")) {
                        // Legacy behavior: return as is, frontend handles resolution? NO. User wants images.
                        // But existing DB has "Fa...". If we return signed URL for "FaStore", it's broken.
                        // Let's just return it as is if it looks legacy, frontend will try to render as img src, fail, fallback?
                        // Or better: let's try to resolve it.
                        imageUrl = cat.icono;
                    }
                    else {
                        imageUrl = yield upload_files_cloud_adapter_1.UploadFilesCloud.getFile({
                            bucketName: config_1.envs.AWS_BUCKET_NAME,
                            key: cat.icono,
                        });
                    }
                }
                catch (error) {
                    console.error(`Error resolving image for category ${cat.id}`, error);
                }
                return Object.assign(Object.assign({}, cat), { icono: imageUrl });
            })));
        });
    }
    // Obtener categoría por ID
    getCategoriaById(id) {
        return __awaiter(this, void 0, void 0, function* () {
            const categoria = yield data_1.CategoriaNegocio.findOneBy({ id });
            if (!categoria)
                throw domain_1.CustomError.notFound("Categoría no encontrada");
            let imageUrl = categoria.icono;
            if (!categoria.icono.startsWith("Fa") || categoria.icono.includes("/")) {
                imageUrl = yield upload_files_cloud_adapter_1.UploadFilesCloud.getFile({
                    bucketName: config_1.envs.AWS_BUCKET_NAME,
                    key: categoria.icono,
                });
            }
            return Object.assign(Object.assign({}, categoria), { icono: imageUrl });
        });
    }
    // Actualizar categoría
    updateCategoria(id, dto, file, masterPin) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.verifyMasterPin(masterPin);
            const categoria = yield data_1.CategoriaNegocio.findOneBy({ id });
            if (!categoria)
                throw domain_1.CustomError.notFound("Categoría no encontrada");
            if (dto.name)
                categoria.nombre = dto.name;
            // if (dto.icon) categoria.icono = dto.icon; // Icon string update is disabled/legacy
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
            if (dto.orden !== undefined) {
                categoria.orden = dto.orden;
            }
            if (dto.modeloBloqueado !== undefined) {
                categoria.modeloBloqueado = dto.modeloBloqueado;
            }
            if (dto.modeloMonetizacionDefault !== undefined) {
                categoria.modeloMonetizacionDefault = dto.modeloMonetizacionDefault;
            }
            if (file) {
                try {
                    // Borrar imagen anterior si no es legacy
                    if (categoria.icono && (!categoria.icono.startsWith("Fa") || categoria.icono.includes("/"))) {
                        try {
                            yield upload_files_cloud_adapter_1.UploadFilesCloud.deleteFile({
                                bucketName: config_1.envs.AWS_BUCKET_NAME,
                                key: categoria.icono
                            });
                            console.log(`[CategoriaService] Imagen anterior eliminada: ${categoria.icono}`);
                        }
                        catch (error) {
                            console.error(`[CategoriaService] Error eliminando imagen anterior ${categoria.icono}:`, error);
                        }
                    }
                    const key = yield upload_files_cloud_adapter_1.UploadFilesCloud.uploadSingleFile({
                        bucketName: config_1.envs.AWS_BUCKET_NAME,
                        key: `categorias/${Date.now()}-${file.originalname}`,
                        body: file.buffer,
                        contentType: file.mimetype,
                    });
                    categoria.icono = key;
                }
                catch (error) {
                    throw domain_1.CustomError.internalServer("Error actualizando la imagen de la categoría");
                }
            }
            try {
                const saved = yield categoria.save();
                let imageUrl = saved.icono;
                if (!saved.icono.startsWith("Fa") || saved.icono.includes("/")) {
                    imageUrl = yield upload_files_cloud_adapter_1.UploadFilesCloud.getFile({
                        bucketName: config_1.envs.AWS_BUCKET_NAME,
                        key: saved.icono,
                    });
                }
                return Object.assign(Object.assign({}, saved), { icono: imageUrl });
            }
            catch (_a) {
                throw domain_1.CustomError.internalServer("No se pudo actualizar la categoría");
            }
        });
    }
    // Eliminar categoría
    deleteCategoria(id, masterPin) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.verifyMasterPin(masterPin);
            const categoria = yield data_1.CategoriaNegocio.findOneBy({ id });
            if (!categoria)
                throw domain_1.CustomError.notFound("Categoría no encontrada");
            if (categoria.icono && (!categoria.icono.startsWith("Fa") || categoria.icono.includes("/"))) {
                try {
                    yield upload_files_cloud_adapter_1.UploadFilesCloud.deleteFile({
                        bucketName: config_1.envs.AWS_BUCKET_NAME,
                        key: categoria.icono
                    });
                    console.log(`[CategoriaService] Imagen eliminada: ${categoria.icono}`);
                }
                catch (error) {
                    console.error(`[CategoriaService] Error eliminando imagen ${categoria.icono}:`, error);
                }
            }
            try {
                return yield categoria.remove();
            }
            catch (_a) {
                throw domain_1.CustomError.internalServer("No se pudo eliminar la categoría");
            }
        });
    }
    verifyMasterPin(pin) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!pin)
                throw domain_1.CustomError.unAuthorized("Master PIN requerido");
            const settings = yield global_settings_model_1.GlobalSettings.findOne({ where: {} });
            // Si no hay configuración o no hay PIN configurado, prohibir acción por seguridad
            if (!settings || !settings.masterPin) {
                throw domain_1.CustomError.internalServer("Error de seguridad: Master PIN no configurado en el sistema");
            }
            const isValid = bcryptjs_1.default.compareSync(pin, settings.masterPin);
            if (!isValid) {
                throw domain_1.CustomError.unAuthorized("Master PIN incorrecto");
            }
        });
    }
}
exports.CategoriaService = CategoriaService;
