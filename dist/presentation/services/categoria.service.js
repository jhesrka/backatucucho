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
    createCategoria(dto, iconFile, masterPin, coverFile) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d, _e;
            yield this.verifyMasterPin(masterPin);
            let key;
            try {
                key = yield upload_files_cloud_adapter_1.UploadFilesCloud.uploadSingleFile({
                    bucketName: config_1.envs.AWS_BUCKET_NAME,
                    key: `categorias/${Date.now()}-${iconFile.originalname}`,
                    body: iconFile.buffer,
                    contentType: iconFile.mimetype,
                });
            }
            catch (error) {
                throw domain_1.CustomError.internalServer("Error subiendo la imagen de la categoría");
            }
            let cover = dto.cover;
            if (coverFile) {
                try {
                    const coverKey = yield upload_files_cloud_adapter_1.UploadFilesCloud.uploadSingleFile({
                        bucketName: config_1.envs.AWS_BUCKET_NAME,
                        key: `categorias/covers/${Date.now()}-${coverFile.originalname}`,
                        body: coverFile.buffer,
                        contentType: coverFile.mimetype,
                    });
                    if (!cover)
                        cover = { type: "image", imageUrl: coverKey };
                    else
                        cover.imageUrl = coverKey;
                }
                catch (error) {
                    throw domain_1.CustomError.internalServer("Error subiendo la imagen de portada");
                }
            }
            const categoria = data_1.CategoriaNegocio.create({
                nombre: dto.name,
                icono: key,
                restriccionModeloMonetizacion: (_a = dto.restriccionModeloMonetizacion) !== null && _a !== void 0 ? _a : null,
                soloComision: (_b = dto.soloComision) !== null && _b !== void 0 ? _b : false,
                orden: (_c = dto.orden) !== null && _c !== void 0 ? _c : 0,
                modeloBloqueado: (_d = dto.modeloBloqueado) !== null && _d !== void 0 ? _d : false,
                modeloMonetizacionDefault: (_e = dto.modeloMonetizacionDefault) !== null && _e !== void 0 ? _e : null,
                cover: cover !== null && cover !== void 0 ? cover : null,
            });
            try {
                const saved = yield categoria.save();
                const imageUrl = yield upload_files_cloud_adapter_1.UploadFilesCloud.getFile({
                    bucketName: config_1.envs.AWS_BUCKET_NAME,
                    key: saved.icono,
                });
                let coverResult = saved.cover;
                if (coverResult === null || coverResult === void 0 ? void 0 : coverResult.imageUrl) {
                    try {
                        coverResult.imageUrl = yield upload_files_cloud_adapter_1.UploadFilesCloud.getFile({
                            bucketName: config_1.envs.AWS_BUCKET_NAME,
                            key: coverResult.imageUrl,
                        });
                    }
                    catch (e) {
                        console.error(e);
                    }
                }
                return Object.assign(Object.assign({}, saved), { icono: imageUrl, cover: coverResult });
            }
            catch (_f) {
                throw domain_1.CustomError.internalServer("No se pudo guardar la categoría");
            }
        });
    }
    // Obtener todas las categorías
    getAllCategorias(status) {
        return __awaiter(this, void 0, void 0, function* () {
            const whereCondition = {};
            if (status) {
                whereCondition.statusCategoria = status;
            }
            const categorias = yield data_1.CategoriaNegocio.find({
                where: whereCondition,
                order: { orden: "ASC", created_at: "ASC" },
                relations: ["subcategorias"]
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
                let coverResult = cat.cover;
                if (coverResult === null || coverResult === void 0 ? void 0 : coverResult.imageUrl) {
                    try {
                        coverResult.imageUrl = yield upload_files_cloud_adapter_1.UploadFilesCloud.getFile({
                            bucketName: config_1.envs.AWS_BUCKET_NAME,
                            key: coverResult.imageUrl,
                        });
                    }
                    catch (e) {
                        console.error(`Error resolving cover image for category ${cat.id}`, e);
                    }
                }
                return Object.assign(Object.assign({}, cat), { icono: imageUrl, cover: coverResult });
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
            let coverResult = categoria.cover;
            if (coverResult === null || coverResult === void 0 ? void 0 : coverResult.imageUrl) {
                try {
                    coverResult.imageUrl = yield upload_files_cloud_adapter_1.UploadFilesCloud.getFile({
                        bucketName: config_1.envs.AWS_BUCKET_NAME,
                        key: coverResult.imageUrl,
                    });
                }
                catch (e) {
                    console.error(e);
                }
            }
            return Object.assign(Object.assign({}, categoria), { icono: imageUrl, cover: coverResult });
        });
    }
    // Actualizar categoría
    updateCategoria(id, dto, iconFile, masterPin, coverFile) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
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
            if (dto.cover !== undefined) {
                const parsedCover = dto.cover;
                // 🛡️ DEFINITIVE S3 PRE-SIGNED URL FIX:
                // If imageUrl is a temporary HTTP pre-signed URL, preserve the existing raw key from the database.
                if (parsedCover && parsedCover.imageUrl && parsedCover.imageUrl.startsWith('http')) {
                    if ((_a = categoria.cover) === null || _a === void 0 ? void 0 : _a.imageUrl) {
                        parsedCover.imageUrl = categoria.cover.imageUrl;
                    }
                }
                categoria.cover = parsedCover;
            }
            if (iconFile) {
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
                        key: `categorias/${Date.now()}-${iconFile.originalname}`,
                        body: iconFile.buffer,
                        contentType: iconFile.mimetype,
                    });
                    categoria.icono = key;
                }
                catch (error) {
                    throw domain_1.CustomError.internalServer("Error actualizando la imagen de la categoría");
                }
            }
            if (coverFile) {
                try {
                    // Borrar imagen de portada anterior si existe
                    if ((_b = categoria.cover) === null || _b === void 0 ? void 0 : _b.imageUrl) {
                        try {
                            yield upload_files_cloud_adapter_1.UploadFilesCloud.deleteFile({
                                bucketName: config_1.envs.AWS_BUCKET_NAME,
                                key: categoria.cover.imageUrl
                            });
                        }
                        catch (e) {
                            console.error("[CategoriaService] Error eliminando cover anterior:", e);
                        }
                    }
                    const coverKey = yield upload_files_cloud_adapter_1.UploadFilesCloud.uploadSingleFile({
                        bucketName: config_1.envs.AWS_BUCKET_NAME,
                        key: `categorias/covers/${Date.now()}-${coverFile.originalname}`,
                        body: coverFile.buffer,
                        contentType: coverFile.mimetype,
                    });
                    if (!categoria.cover)
                        categoria.cover = { type: "image", imageUrl: coverKey };
                    else
                        categoria.cover = Object.assign(Object.assign({}, categoria.cover), { imageUrl: coverKey });
                }
                catch (error) {
                    throw domain_1.CustomError.internalServer("Error actualizando la imagen de portada");
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
                let coverResult = saved.cover;
                if (coverResult === null || coverResult === void 0 ? void 0 : coverResult.imageUrl) {
                    try {
                        coverResult.imageUrl = yield upload_files_cloud_adapter_1.UploadFilesCloud.getFile({
                            bucketName: config_1.envs.AWS_BUCKET_NAME,
                            key: coverResult.imageUrl,
                        });
                    }
                    catch (e) {
                        console.error(e);
                    }
                }
                return Object.assign(Object.assign({}, saved), { icono: imageUrl, cover: coverResult });
            }
            catch (_c) {
                throw domain_1.CustomError.internalServer("No se pudo actualizar la categoría");
            }
        });
    }
    // Eliminar categoría
    deleteCategoria(id, masterPin) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
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
            if ((_a = categoria.cover) === null || _a === void 0 ? void 0 : _a.imageUrl) {
                try {
                    yield upload_files_cloud_adapter_1.UploadFilesCloud.deleteFile({
                        bucketName: config_1.envs.AWS_BUCKET_NAME,
                        key: categoria.cover.imageUrl
                    });
                    console.log(`[CategoriaService] Cover eliminado: ${categoria.cover.imageUrl}`);
                }
                catch (error) {
                    console.error(`[CategoriaService] Error eliminando cover ${categoria.cover.imageUrl}:`, error);
                }
            }
            try {
                return yield categoria.remove();
            }
            catch (_b) {
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
    seedBusinessCategories() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { SubcategoriaNegocio } = require("../../data");
                const { AgeVerificationQuestion } = require("../../data/postgres/models/AgeVerificationQuestion");
                // 1. Crear Categoría "Comida y Bebidas" si no existe
                let cat = yield data_1.CategoriaNegocio.findOne({ where: { nombre: "Comida y Bebidas" } });
                if (!cat) {
                    const { RestriccionModeloMonetizacion } = require("../../data/postgres/models/CategoriaNegocio");
                    cat = data_1.CategoriaNegocio.create({
                        nombre: "Comida y Bebidas",
                        icono: "default-icon.png", // Reemplazar con lógica real de iconos si es necesario
                        restriccionModeloMonetizacion: RestriccionModeloMonetizacion.COMISION_SUSCRIPCION,
                        soloComision: true,
                        orden: 1,
                        modeloBloqueado: true,
                        modeloMonetizacionDefault: RestriccionModeloMonetizacion.COMISION_SUSCRIPCION,
                    });
                    yield cat.save();
                }
                else if (cat.restriccionModeloMonetizacion !== "COMISION_SUSCRIPCION" ||
                    !cat.modeloBloqueado ||
                    !cat.soloComision) {
                    cat.restriccionModeloMonetizacion = "COMISION_SUSCRIPCION";
                    cat.modeloMonetizacionDefault = "COMISION_SUSCRIPCION";
                    cat.modeloBloqueado = true;
                    cat.soloComision = true;
                    yield cat.save();
                }
                // 2. Crear Subcategoría "Licorerías"
                let subcat = yield SubcategoriaNegocio.findOne({ where: { nombre: "Licorerías", categoria: { id: cat.id } } });
                if (!subcat) {
                    subcat = SubcategoriaNegocio.create({
                        nombre: "Licorerías",
                        orden: 1,
                        isAgeRestricted: true,
                        categoria: cat
                    });
                    yield subcat.save();
                }
                else if (!subcat.isAgeRestricted) {
                    subcat.isAgeRestricted = true;
                    yield subcat.save();
                }
                // 3. Crear Preguntas de Verificación por Defecto
                const defaultQuestions = [
                    "¿El cliente coincide con la foto de la cédula mostrada?",
                    "¿El cliente tiene más de 18 años según su fecha de nacimiento?",
                    "¿El cliente NO presenta signos evidentes de ebriedad?"
                ];
                for (let i = 0; i < defaultQuestions.length; i++) {
                    const text = defaultQuestions[i];
                    let q = yield AgeVerificationQuestion.findOne({ where: { pregunta: text } });
                    if (!q) {
                        q = new AgeVerificationQuestion();
                        q.pregunta = text;
                        q.activa = true;
                        q.orden = i + 1;
                        yield q.save();
                    }
                }
                return { message: "Seed de categorías de negocio completado con éxito." };
            }
            catch (error) {
                console.error(error);
                throw domain_1.CustomError.internalServer("Error al sembrar categorías de negocio");
            }
        });
    }
}
exports.CategoriaService = CategoriaService;
