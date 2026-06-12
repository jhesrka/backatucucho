"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
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
exports.PostService = void 0;
// src/presentation/services/post.service.ts
const typeorm_1 = require("typeorm");
const config_1 = require("../../config");
const socket_1 = require("../../config/socket");
const upload_files_cloud_adapter_1 = require("../../config/upload-files-cloud-adapter");
const data_1 = require("../../data");
const domain_1 = require("../../domain");
const uuid_1 = require("uuid");
const content_moderation_1 = require("../../config/content-moderation");
const PostReport_1 = require("../../data/postgres/models/PostReport");
const date_utils_1 = require("../../utils/date-utils");
class PostService {
    constructor(userService, subscriptionService, freePostTrackerService, globalSettingsService) {
        this.userService = userService;
        this.subscriptionService = subscriptionService;
        this.freePostTrackerService = freePostTrackerService;
        this.globalSettingsService = globalSettingsService;
    }
    //este ya esta funcionando
    findAllPostPaginated(page, limit, userId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const skip = (page - 1) * limit;
                const now = new Date();
                // 1. Consulta base con condiciones de expiración
                const query = data_1.Post.createQueryBuilder("post")
                    .leftJoinAndSelect("post.user", "user")
                    .where("post.statusPost = :status", { status: data_1.StatusPost.PUBLISHED })
                    .andWhere("(post.isPaid = true OR (post.expiresAt IS NULL OR post.expiresAt > :now))", { now })
                    .orderBy("post.createdAt", "DESC")
                    .skip(skip)
                    .take(limit);
                const [posts, total] = yield query.getManyAndCount();
                // Filtrar los posts pagados cuyo autor no tiene suscripción activa
                const filteredPosts = yield Promise.all(posts.map((post) => __awaiter(this, void 0, void 0, function* () {
                    if (!post.user)
                        return null; // Post huérfano
                    if (post.isPaid) {
                        const hasSubscription = yield this.subscriptionService.hasActiveSubscription(post.user.id);
                        return hasSubscription ? post : null;
                    }
                    return post; // Los gratuitos se mantienen
                })));
                // Limpiar nulos (posts eliminados o inviables)
                const validPosts = filteredPosts.filter((p) => p !== null);
                // 2. Procesar posts expirados en segundo plano
                this.processExpiredPosts().catch((error) => {
                    console.error("Error al procesar posts expirados:", error);
                });
                // 3. Procesamiento optimizado de imágenes + CHECK LIKES
                const formattedPosts = yield Promise.all(validPosts.map((post) => __awaiter(this, void 0, void 0, function* () {
                    var _a, _b, _c;
                    try {
                        const { Producto } = yield Promise.resolve().then(() => __importStar(require("../../data")));
                        let negocioId = null;
                        let imagenNegocioKey = null;
                        if (post.productoId) {
                            const prod = yield Producto.findOne({ where: { id: post.productoId }, relations: ["negocio"] });
                            if (prod && prod.negocio) {
                                negocioId = prod.negocio.id;
                                imagenNegocioKey = prod.negocio.imagenNegocio;
                            }
                        }
                        const [imgs, userImage, isLiked, imagenNegocioUrl] = yield Promise.all([
                            Promise.all(((_a = post.imgpost) !== null && _a !== void 0 ? _a : []).map((img) => upload_files_cloud_adapter_1.UploadFilesCloud.getOptimizedUrls({
                                bucketName: config_1.envs.AWS_BUCKET_NAME,
                                key: img,
                            }))),
                            ((_b = post.user) === null || _b === void 0 ? void 0 : _b.photoperfil)
                                ? upload_files_cloud_adapter_1.UploadFilesCloud.getOptimizedUrls({
                                    bucketName: config_1.envs.AWS_BUCKET_NAME,
                                    key: post.user.photoperfil,
                                })
                                : Promise.resolve(null),
                            userId
                                ? data_1.Like.findOne({
                                    where: { post: { id: post.id }, user: { id: userId } },
                                }).then((like) => !!like)
                                : Promise.resolve(false),
                            imagenNegocioKey
                                ? upload_files_cloud_adapter_1.UploadFilesCloud.getOptimizedUrls({
                                    bucketName: config_1.envs.AWS_BUCKET_NAME,
                                    key: imagenNegocioKey,
                                })
                                : Promise.resolve(null),
                        ]);
                        return Object.assign(Object.assign({}, post), { imgpost: imgs, negocioId, imagenNegocio: imagenNegocioUrl, user: {
                                id: post.user.id,
                                name: post.user.name,
                                surname: post.user.surname,
                                whatsapp: post.user.whatsapp,
                                photoperfil: userImage,
                            }, totalLikes: (_c = post.likesCount) !== null && _c !== void 0 ? _c : 0, isLiked });
                    }
                    catch (error) {
                        console.error(`Error processing post ${post.id}:`, error);
                        return null;
                    }
                })));
                return {
                    total,
                    totalPages: Math.ceil(total / limit),
                    currentPage: page,
                    posts: formattedPosts.filter(p => p !== null),
                };
            }
            catch (error) {
                console.error("Critical error in findAllPostPaginated:", error);
                throw domain_1.CustomError.internalServer("Error al obtener posts paginados. Detalle: " + error.message);
            }
        });
    }
    // Método para manejar posts expirados
    processExpiredPosts() {
        return __awaiter(this, void 0, void 0, function* () {
            const now = new Date();
            // Buscar posts públicos gratuitos que hayan expirado
            const expiredPosts = yield data_1.Post.createQueryBuilder("post")
                .where("post.statusPost = :status", { status: data_1.StatusPost.PUBLISHED })
                .andWhere("post.isPaid = false")
                .andWhere("post.expiresAt <= :now", { now })
                .getMany();
            if (expiredPosts.length > 0) {
                for (const post of expiredPosts) {
                    yield this.hardDeletePost(post);
                }
            }
        });
    }
    searchPost(searchTerm, userId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const now = new Date();
                // 1. Consulta con los MISMOS filtros que findAllPostPaginated:
                //    - Solo PUBLISHED
                //    - Posts pagados o gratuitos no expirados
                const query = data_1.Post.createQueryBuilder("post")
                    .leftJoinAndSelect("post.user", "user")
                    .where("post.statusPost = :status", { status: data_1.StatusPost.PUBLISHED })
                    .andWhere("(post.isPaid = true OR (post.expiresAt IS NULL OR post.expiresAt > :now))", { now })
                    .andWhere("(LOWER(post.title) LIKE LOWER(:term) OR LOWER(post.subtitle) LIKE LOWER(:term) OR LOWER(user.name) LIKE LOWER(:term) OR LOWER(user.surname) LIKE LOWER(:term))", { term: `%${searchTerm}%` })
                    .orderBy("post.createdAt", "DESC");
                const posts = yield query.getMany();
                // 2. Filtrar posts pagados sin suscripción activa + posts huérfanos
                const filteredPosts = yield Promise.all(posts.map((post) => __awaiter(this, void 0, void 0, function* () {
                    if (!post.user)
                        return null; // Post huérfano
                    if (post.isPaid) {
                        const hasSubscription = yield this.subscriptionService.hasActiveSubscription(post.user.id);
                        return hasSubscription ? post : null;
                    }
                    return post; // Gratuitos se mantienen
                })));
                const validPosts = filteredPosts.filter((p) => p !== null);
                // 3. Resolviendo imágenes + LIKES (mismo formato que el feed)
                const resolvedPosts = yield Promise.all(validPosts.map((post) => __awaiter(this, void 0, void 0, function* () {
                    var _a, _b, _c;
                    try {
                        const [resolvedImgs, userImage, isLiked] = yield Promise.all([
                            Promise.all(((_a = post.imgpost) !== null && _a !== void 0 ? _a : []).map((img) => upload_files_cloud_adapter_1.UploadFilesCloud.getOptimizedUrls({
                                bucketName: config_1.envs.AWS_BUCKET_NAME,
                                key: img,
                            }))),
                            ((_b = post.user) === null || _b === void 0 ? void 0 : _b.photoperfil)
                                ? upload_files_cloud_adapter_1.UploadFilesCloud.getOptimizedUrls({
                                    bucketName: config_1.envs.AWS_BUCKET_NAME,
                                    key: post.user.photoperfil,
                                })
                                : Promise.resolve(null),
                            userId
                                ? data_1.Like.findOne({
                                    where: { post: { id: post.id }, user: { id: userId } },
                                }).then((like) => !!like)
                                : Promise.resolve(false),
                        ]);
                        return Object.assign(Object.assign({}, post), { imgpost: resolvedImgs, user: {
                                id: post.user.id,
                                name: post.user.name,
                                surname: post.user.surname,
                                whatsapp: post.user.whatsapp,
                                photoperfil: userImage,
                            }, totalLikes: (_c = post.likesCount) !== null && _c !== void 0 ? _c : 0, isLiked });
                    }
                    catch (error) {
                        console.error(`Error processing search post ${post.id}:`, error);
                        return null;
                    }
                })));
                return resolvedPosts.filter((p) => p !== null);
            }
            catch (error) {
                console.error("Error en searchPost:", error);
                throw domain_1.CustomError.internalServer("Error buscando los posts");
            }
        });
    }
    findOnePost(id, userId) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const post = yield data_1.Post.findOne({
                where: { id },
                relations: ["user"],
                select: {
                    user: {
                        id: true,
                        name: true,
                        surname: true,
                        photoperfil: true,
                        whatsapp: true,
                    },
                },
            });
            if (!post)
                throw domain_1.CustomError.notFound("Post no encontrado");
            const [resolvedImgs, userImage, isLiked] = yield Promise.all([
                Promise.all(((_a = post.imgpost) !== null && _a !== void 0 ? _a : []).map((img) => __awaiter(this, void 0, void 0, function* () {
                    return yield upload_files_cloud_adapter_1.UploadFilesCloud.getOptimizedUrls({
                        bucketName: config_1.envs.AWS_BUCKET_NAME,
                        key: img,
                    });
                }))),
                upload_files_cloud_adapter_1.UploadFilesCloud.getOptimizedUrls({
                    bucketName: config_1.envs.AWS_BUCKET_NAME,
                    key: post.user.photoperfil,
                }),
                userId
                    ? data_1.Like.findOne({
                        where: { post: { id: post.id }, user: { id: userId } },
                    }).then((like) => !!like)
                    : Promise.resolve(false),
            ]);
            return Object.assign(Object.assign({}, post), { imgpost: resolvedImgs, user: Object.assign(Object.assign({}, post.user), { photoperfil: userImage }), isLiked });
        });
    }
    createPostPlan(postData, imgs) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            try {
                // 1. Validar usuario
                const user = yield this.userService.findOneUser(postData.userId);
                if (!user)
                    throw domain_1.CustomError.notFound("Usuario no encontrado");
                // 1.5 Validar aceptación de términos y privacidad (Versionado)
                const settings = yield this.globalSettingsService.getSettings();
                if (!user.acceptedTermsVersion || user.acceptedTermsVersion !== settings.currentTermsVersion ||
                    !user.acceptedPrivacyVersion || user.acceptedPrivacyVersion !== settings.currentTermsVersion) {
                    throw domain_1.CustomError.forbiden("Debes aceptar los términos y condiciones actualizados antes de publicar.");
                }
                // 2. Validar suscripción e imágenes si es post pago
                if (postData.isPaid) {
                    const hasActiveSub = yield this.subscriptionService.hasActiveSubscription(user.id);
                    if (!hasActiveSub) {
                        throw domain_1.CustomError.forbiden("Requieres suscripción activa para posts pagos");
                    }
                    if (imgs && imgs.length > 5) {
                        throw domain_1.CustomError.badRequest("Los posts pagados permiten un máximo de 5 imágenes");
                    }
                }
                else {
                    // Validación para posts gratuitos
                    if (imgs && imgs.length > 1) {
                        throw domain_1.CustomError.badRequest("Los posts gratuitos solo permiten 1 imagen");
                    }
                }
                // 3. Manejar posts gratuitos (límite mensual y duración configurable)
                let freePostTracker;
                if (!postData.isPaid) {
                    freePostTracker = yield this.freePostTrackerService.getOrCreateTracker(user.id);
                    if (freePostTracker.count >= settings.freePostsLimit) {
                        throw domain_1.CustomError.forbiden(`Límite de posts gratuitos alcanzado (${settings.freePostsLimit}/mes)`);
                    }
                    // Incrementar contador
                    freePostTracker.count += 1;
                    yield freePostTracker.save();
                }
                // 4. Subir imágenes a AWS si existen
                let keys = [];
                let urls = [];
                if (imgs && imgs.length > 0) {
                    keys = yield Promise.all(imgs.map((img) => upload_files_cloud_adapter_1.UploadFilesCloud.uploadSingleFile({
                        bucketName: config_1.envs.AWS_BUCKET_NAME,
                        key: `posts/${Date.now()}-${img.originalname}`,
                        body: img.buffer,
                        contentType: img.mimetype,
                    })));
                    // Obtener URLs firmadas optimizadas
                    urls = (yield Promise.all(keys.map((key) => upload_files_cloud_adapter_1.UploadFilesCloud.getOptimizedUrls({
                        bucketName: config_1.envs.AWS_BUCKET_NAME,
                        key,
                    }))));
                }
                // 4.5. Validar contenido (Moderación automática)
                if ((0, content_moderation_1.containsForbiddenWords)(postData.title) ||
                    (0, content_moderation_1.containsForbiddenWords)(postData.subtitle) ||
                    (0, content_moderation_1.containsForbiddenWords)(postData.content)) {
                    throw domain_1.CustomError.badRequest("Tu contenido contiene texto no permitido. Corrígelo para continuar.");
                }
                // 5. Crear y guardar el post
                const post = new data_1.Post();
                post.title = postData.title.toLowerCase().trim();
                post.subtitle = postData.subtitle.toLowerCase().trim();
                post.content = postData.content.trim();
                post.user = user;
                post.isPaid = postData.isPaid || false;
                post.imgpost = keys;
                post.showWhatsApp = (_a = postData.showWhatsApp) !== null && _a !== void 0 ? _a : true;
                post.showLikes = (_b = postData.showLikes) !== null && _b !== void 0 ? _b : true;
                // --- Lógica para publicación de productos ---
                if (postData.productoId) {
                    const { Producto } = yield Promise.resolve().then(() => __importStar(require("../../data")));
                    const productoOriginal = yield Producto.findOne({
                        where: { id: postData.productoId },
                        relations: ["negocio"]
                    });
                    if (!productoOriginal)
                        throw domain_1.CustomError.notFound("Producto no encontrado");
                    const negocio = productoOriginal.negocio;
                    if (!negocio)
                        throw domain_1.CustomError.badRequest("No tienes un negocio asociado para publicar productos");
                    if (!negocio.puedePublicarProductos)
                        throw domain_1.CustomError.forbiden("Tu negocio no tiene habilitada la publicación de productos en el feed");
                    if (negocio.publicacionesRestantes <= 0)
                        throw domain_1.CustomError.forbiden("Has agotado tu límite de publicaciones para este ciclo");
                    post.productoId = postData.productoId;
                    post.precioProducto = postData.precioProducto;
                    if (negocio.fechaFinSuscripcion) {
                        post.expiresAt = negocio.fechaFinSuscripcion;
                    }
                    else {
                        post.expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 dias de gracia
                    }
                    // Descontar
                    negocio.publicacionesRestantes -= 1;
                    yield negocio.save();
                    // COPIAR IMAGEN DEL PRODUCTO SI NO HAY MEDIA NUEVA
                    if (keys.length === 0 && !postData.videoUrl) {
                        if (productoOriginal.imagen) {
                            post.imgpost = [productoOriginal.imagen];
                        }
                    }
                }
                if (postData.videoUrl) {
                    post.videoUrl = postData.videoUrl;
                    if (postData.videoUrl.includes('youtube') || postData.videoUrl.includes('youtu.be')) {
                        post.videoPlatform = 'youtube';
                    }
                    else if (postData.videoUrl.includes('tiktok')) {
                        post.videoPlatform = 'tiktok';
                    }
                    else {
                        post.videoPlatform = 'unknown';
                    }
                }
                // --- Lógica de Programación ---
                if (postData.scheduledAt) {
                    const scheduledDate = new Date(postData.scheduledAt);
                    const now = new Date();
                    const minDate = new Date(now.getTime() + 55 * 60 * 1000); // ~1 hora (margen de 5 min)
                    if (scheduledDate < minDate) {
                        throw domain_1.CustomError.badRequest("La fecha programada debe ser al menos 1 hora en el futuro.");
                    }
                    const latestSub = yield this.subscriptionService.getLatestSubscription(user.id);
                    if (!latestSub || !latestSub.isActive()) {
                        throw domain_1.CustomError.forbiden("No puedes programar publicaciones sin una suscripción activa.");
                    }
                    if (latestSub.endDate && scheduledDate > latestSub.endDate) {
                        throw domain_1.CustomError.forbiden(`No puedes programar fuera del rango de tu suscripción (Expiración: ${latestSub.endDate.toLocaleDateString()}).`);
                    }
                    // Límite de posts programados
                    const scheduledCount = yield data_1.Post.count({
                        where: { user: { id: user.id }, statusPost: data_1.StatusPost.SCHEDULED }
                    });
                    if (scheduledCount >= 10) {
                        throw domain_1.CustomError.badRequest("Has alcanzado el límite máximo de 10 publicaciones programadas.");
                    }
                    post.statusPost = data_1.StatusPost.SCHEDULED;
                    post.scheduledAt = scheduledDate;
                }
                else {
                    post.statusPost = data_1.StatusPost.PUBLISHED;
                    post.publishedAt = new Date();
                }
                // ------------------------------
                // Configurar expiración para posts gratuitos (Si NO es un producto)
                if (!post.productoId && !post.isPaid && freePostTracker && settings) {
                    const durationMs = (settings.freePostDurationDays * 24 * 60 * 60 * 1000) +
                        (settings.freePostDurationHours * 60 * 60 * 1000);
                    post.expiresAt = new Date(Date.now() + durationMs);
                    post.freePostTracker = freePostTracker;
                }
                else if (!post.productoId && !post.isPaid) {
                    throw domain_1.CustomError.internalServer("Error al asignar el tracker de posts gratuitos");
                }
                const postSaved = yield post.save();
                // 6. Preparar respuesta segura
                const safeResponse = {
                    id: postSaved.id,
                    title: postSaved.title,
                    subtitle: postSaved.subtitle,
                    content: postSaved.content,
                    isPaid: postSaved.isPaid,
                    imgpost: urls,
                    expiresAt: postSaved.expiresAt,
                    createdAt: postSaved.createdAt,
                    scheduledAt: postSaved.scheduledAt,
                    statusPost: postSaved.statusPost,
                    showWhatsApp: postSaved.showWhatsApp,
                    showLikes: postSaved.showLikes,
                    productoId: postSaved.productoId,
                    precioProducto: postSaved.precioProducto,
                    videoUrl: postSaved.videoUrl,
                    videoPlatform: postSaved.videoPlatform,
                    user: {
                        id: user.id,
                        name: user.name,
                        surname: user.surname,
                        photoperfil: user.photoperfil
                            ? yield upload_files_cloud_adapter_1.UploadFilesCloud.getFile({ bucketName: config_1.envs.AWS_BUCKET_NAME, key: user.photoperfil })
                            : null,
                    },
                };
                postSaved.imgpost = urls; // Asignar URLs para la respuesta
                // 6. Emitir evento de socket
                (0, socket_1.getIO)().emit("postChanged", {
                    action: postData.scheduledAt ? "schedule" : "create",
                    post: safeResponse,
                });
                return safeResponse;
            }
            catch (error) {
                // Verifica si es un error de TypeORM
                if (typeof error === "object" && error !== null && "code" in error) {
                    const dbError = error;
                    if (dbError.code === "23505") {
                        throw domain_1.CustomError.badRequest("El post ya existe");
                    }
                    else if (dbError.code === "23502") {
                        throw domain_1.CustomError.badRequest("Faltan campos obligatorios");
                    }
                }
                // Si ya es un CustomError
                if (error instanceof domain_1.CustomError) {
                    throw error;
                }
                console.error("Error creating post:", error);
                throw domain_1.CustomError.internalServer("Error al crear el post");
            }
        });
    }
    getPostsByUser(userId_1) {
        return __awaiter(this, arguments, void 0, function* (userId, page = 1) {
            try {
                const take = 5;
                const skip = (page - 1) * take;
                // Validación adicional en el servicio
                if (!userId)
                    throw new Error("ID de usuario no proporcionado");
                const [posts, total] = yield data_1.Post.findAndCount({
                    where: {
                        user: { id: userId },
                    },
                    relations: ["user", "user.subscriptions"],
                    order: { createdAt: "DESC" },
                    take,
                    skip,
                });
                // Procesamiento de imágenes con manejo de errores
                const processedPosts = yield Promise.all(posts.map((post) => __awaiter(this, void 0, void 0, function* () {
                    var _a, _b, _c;
                    try {
                        const [imgs, userImage] = yield Promise.all([
                            Promise.all(((_a = post.imgpost) !== null && _a !== void 0 ? _a : []).map((img) => upload_files_cloud_adapter_1.UploadFilesCloud.getFile({
                                bucketName: config_1.envs.AWS_BUCKET_NAME,
                                key: img,
                            }).catch(() => null))),
                            ((_b = post.user) === null || _b === void 0 ? void 0 : _b.photoperfil)
                                ? upload_files_cloud_adapter_1.UploadFilesCloud.getFile({
                                    bucketName: config_1.envs.AWS_BUCKET_NAME,
                                    key: post.user.photoperfil,
                                }).catch(() => null)
                                : null,
                        ]);
                        return Object.assign(Object.assign({}, post), { imgpost: imgs.filter((img) => img !== null), user: {
                                id: post.user.id,
                                name: post.user.name,
                                surname: post.user.surname,
                                photoperfil: userImage,
                                whatsapp: post.user.whatsapp,
                            }, subscription: ((_c = post.user.subscriptions) === null || _c === void 0 ? void 0 : _c.length)
                                ? {
                                    id: post.user.subscriptions[0].id, // puedes filtrar la activa
                                    status: post.user.subscriptions[0].status,
                                    plan: post.user.subscriptions[0].plan,
                                }
                                : null, likesCount: post.likesCount || 0 });
                    }
                    catch (error) {
                        return null;
                    }
                })));
                return {
                    total,
                    currentPage: page,
                    totalPages: Math.ceil(total / take),
                    posts: processedPosts.filter((post) => post !== null),
                };
            }
            catch (error) {
                throw error; // Re-lanzar para manejo en el controlador
            }
        });
    }
    // ADMIN: Get all posts for a specific user (Paginated, All Statuses)
    getPostsByUserAdmin(userId_1) {
        return __awaiter(this, arguments, void 0, function* (userId, page = 1, limit = 10) {
            try {
                const skip = (page - 1) * limit;
                const [posts, total] = yield data_1.Post.findAndCount({
                    where: { user: { id: userId } }, // No status filter implies ALL statuses
                    relations: ["user", "user.subscriptions"],
                    order: { createdAt: "DESC" },
                    take: limit,
                    skip: skip
                });
                // Process images
                const formattedPosts = yield Promise.all(posts.map((post) => __awaiter(this, void 0, void 0, function* () {
                    var _a;
                    const resolvedImgs = yield Promise.all(((_a = post.imgpost) !== null && _a !== void 0 ? _a : []).map((img) => upload_files_cloud_adapter_1.UploadFilesCloud.getFile({
                        bucketName: config_1.envs.AWS_BUCKET_NAME,
                        key: img
                    }).catch(() => null)));
                    // Subscription Status Logic for specific user
                    const hasActiveSub = yield this.subscriptionService.hasActiveSubscription(userId);
                    return Object.assign(Object.assign({}, post), { imgpost: resolvedImgs.filter(i => i), hasActiveSubscription: hasActiveSub // Useful for frontend logic
                     });
                })));
                return {
                    posts: formattedPosts,
                    total,
                    totalPages: Math.ceil(total / limit),
                    currentPage: page
                };
            }
            catch (error) {
                console.error("Error in getPostsByUserAdmin:", error);
                throw domain_1.CustomError.internalServer("Error fetching user posts for admin");
            }
        });
    }
    updatePostDate(postId, userId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const post = yield data_1.Post.findOne({
                    where: { id: postId },
                    relations: ["user"],
                });
                if (!post) {
                    throw domain_1.CustomError.notFound("Post no encontrado");
                }
                if (!post.user || post.user.id !== userId) {
                    throw domain_1.CustomError.forbiden("No autorizado para modificar este post");
                }
                post.createdAt = new Date();
                yield post.save();
                return { message: "La fecha del post fue actualizada correctamente" };
            }
            catch (error) {
                if (error instanceof domain_1.CustomError) {
                    throw error;
                }
                throw domain_1.CustomError.internalServer("Ocurrió un error al actualizar la fecha del post");
            }
        });
    }
    deletePost(id, userId) {
        return __awaiter(this, void 0, void 0, function* () {
            const post = yield data_1.Post.findOne({
                where: { id },
                relations: ["user"],
            });
            if (!post)
                throw domain_1.CustomError.notFound("Post no encontrado");
            if (post.user.id !== userId)
                throw domain_1.CustomError.forbiden("No autorizado para eliminar este post");
            // Soft delete: Cambiar estado y marcar fecha
            post.statusPost = data_1.StatusPost.DELETED;
            post.deletedAt = new Date();
            yield post.save();
            (0, socket_1.getIO)().emit("postChanged", { action: "delete", postId: id });
            return { message: "Post movido a la papelera" };
        });
    }
    hardDeletePost(post) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            // 1. Eliminar imágenes de S3 primero
            if (((_a = post.imgpost) === null || _a === void 0 ? void 0 : _a.length) > 0) {
                let isOriginalProductImage = false;
                // Si el post pertenece a un producto, verificar si la imagen es la original
                if (post.productoId) {
                    const { Producto } = yield Promise.resolve().then(() => __importStar(require("../../data")));
                    const producto = yield Producto.findOne({ where: { id: post.productoId } });
                    if (producto && producto.imagen && post.imgpost.includes(producto.imagen)) {
                        isOriginalProductImage = true;
                    }
                }
                if (!isOriginalProductImage) {
                    for (const key of post.imgpost) {
                        try {
                            yield upload_files_cloud_adapter_1.UploadFilesCloud.deleteFile({
                                bucketName: config_1.envs.AWS_BUCKET_NAME,
                                key: key,
                            });
                        }
                        catch (e) {
                            console.error(`Error deleting post image ${key}:`, e);
                            throw domain_1.CustomError.internalServer("Error al eliminar las imágenes del almacenamiento S3. Operación abortada para evitar inconsistencias.");
                        }
                    }
                }
            }
            // 2. Eliminar relaciones (likes, reportes)
            try {
                yield data_1.Like.delete({ post: { id: post.id } });
                yield PostReport_1.PostReport.delete({ post: { id: post.id } });
            }
            catch (e) {
                console.error("Error deleting post relations", e);
                throw domain_1.CustomError.internalServer("Error al eliminar interacciones. Operación abortada.");
            }
            // 3. Eliminar definitivamente el post de la BD
            try {
                yield data_1.Post.remove(post);
            }
            catch (e) {
                console.error("Error deleting post from DB", e);
                throw domain_1.CustomError.internalServer("Error al eliminar el post de la base de datos.");
            }
            (0, socket_1.getIO)().emit("postChanged", {
                action: "hardDelete",
                postId: post.id,
            });
            return { message: "Post eliminado permanentemente" };
        });
    }
    updatePost(id, postData) {
        return __awaiter(this, void 0, void 0, function* () {
            const post = yield data_1.Post.preload(Object.assign({ id }, postData));
            if (!post) {
                throw domain_1.CustomError.notFound("Post no encontrado");
            }
            try {
                const postActualizado = yield post.save();
                return postActualizado;
            }
            catch (_a) {
                throw domain_1.CustomError.internalServer("Error actualizando el Post");
            }
        });
    }
    // ==========================================
    // 🛡️ ADMIN DASHBOARD METHODS
    // ==========================================
    getUnifiedSummary() {
        return __awaiter(this, void 0, void 0, function* () {
            const [postStats, storieStats] = yield Promise.all([
                this.getAdminStats(),
                this.storieStats() // Assuming I add this or call storie service
            ]);
            return {
                posts: postStats,
                stories: storieStats,
                timestamp: new Date()
            };
        });
    }
    // Helper inside PostService or similar
    storieStats() {
        return __awaiter(this, void 0, void 0, function* () {
            const now = new Date();
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
            const [totalStories, published, deleted, blocked, expiringSoon, purgeCandidates] = yield Promise.all([
                data_1.Storie.count(),
                data_1.Storie.count({ where: { statusStorie: data_1.StatusStorie.PUBLISHED } }),
                data_1.Storie.count({ where: { statusStorie: data_1.StatusStorie.DELETED } }),
                data_1.Storie.count({ where: { statusStorie: data_1.StatusStorie.FLAGGED } }),
                data_1.Storie.count({ where: { statusStorie: data_1.StatusStorie.PUBLISHED, expires_at: (0, typeorm_1.LessThan)(tomorrow) } }),
                data_1.Storie.count({ where: { statusStorie: data_1.StatusStorie.DELETED, deletedAt: (0, typeorm_1.LessThan)(thirtyDaysAgo) } })
            ]);
            return {
                totalStories,
                published,
                deleted,
                blocked,
                expiringSoon,
                purgeCandidates
            };
        });
    }
    getAdminStats() {
        return __awaiter(this, void 0, void 0, function* () {
            const totalPosts = yield data_1.Post.count();
            const activePosts = yield data_1.Post.count({ where: { statusPost: data_1.StatusPost.PUBLISHED } });
            const deletedPosts = yield data_1.Post.count({ where: { statusPost: data_1.StatusPost.DELETED } });
            const paidPosts = yield data_1.Post.count({ where: { isPaid: true } });
            const freePosts = yield data_1.Post.count({ where: { isPaid: false } });
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            const last30Days = yield data_1.Post.count({ where: { createdAt: (0, typeorm_1.MoreThan)(thirtyDaysAgo) } });
            return {
                totalPosts,
                activePosts,
                deletedPosts,
                paidPosts,
                freePosts,
                last30Days,
            };
        });
    }
    getAdminPosts(filters_1) {
        return __awaiter(this, arguments, void 0, function* (filters, page = 1, limit = 20) {
            const { id, status, type, startDate, endDate } = filters;
            const query = data_1.Post.createQueryBuilder("post")
                .leftJoinAndSelect("post.user", "user")
                .orderBy("post.createdAt", "DESC")
                .skip((page - 1) * limit)
                .take(limit);
            if (id) {
                // Si hay ID, ignoramos otros filtros para búsqueda global
                query.where("post.id = :id", { id });
            }
            else {
                if (status) {
                    query.andWhere("post.statusPost = :status", { status });
                }
                if (type) {
                    const isPaid = type === 'PAGADO';
                    query.andWhere("post.isPaid = :isPaid", { isPaid });
                }
                if (startDate && startDate !== "") {
                    const { start, end } = date_utils_1.DateUtils.getDayRange(startDate);
                    query.andWhere("post.createdAt BETWEEN :start AND :end", { start, end });
                }
            }
            const [posts, total] = yield query.getManyAndCount();
            const formattedPosts = yield Promise.all(posts.map((post) => __awaiter(this, void 0, void 0, function* () {
                var _a, _b;
                const resolvedImgs = yield Promise.all(((_a = post.imgpost) !== null && _a !== void 0 ? _a : []).map((img) => upload_files_cloud_adapter_1.UploadFilesCloud.getOptimizedUrls({
                    bucketName: config_1.envs.AWS_BUCKET_NAME,
                    key: img,
                }).catch(() => null)));
                const userImage = ((_b = post.user) === null || _b === void 0 ? void 0 : _b.photoperfil)
                    ? yield upload_files_cloud_adapter_1.UploadFilesCloud.getOptimizedUrls({ bucketName: config_1.envs.AWS_BUCKET_NAME, key: post.user.photoperfil }).catch(() => null)
                    : null;
                return Object.assign(Object.assign({}, post), { imgpost: resolvedImgs.filter(i => i), user: Object.assign(Object.assign({}, post.user), { photoperfil: userImage }) });
            })));
            return {
                posts: formattedPosts,
                total,
                totalPages: Math.ceil(total / limit),
                currentPage: page
            };
        });
    }
    /**
     * Ejecución de purga inteligente con filtro opcional
     */
    executeIntelligentPurge() {
        return __awaiter(this, arguments, void 0, function* (type = 'ALL') {
            const settings = yield this.globalSettingsService.getSettings();
            if (type === 'ALL' && !settings.autoPurgeEnabled) {
                console.log("[INTELLIGENT-PURGE] Purga automática desactivada.");
                return { deletedCount: 0 };
            }
            const now = new Date();
            let totalDeleted = 0;
            // --- FASE 1: POSTS GRATUITOS ---
            if (type === 'ALL' || type === 'FREE') {
                const freeRetentionDays = settings.postsRetentionDays || 30;
                const freeLimit = new Date();
                freeLimit.setDate(freeLimit.getDate() - freeRetentionDays);
                const freeCandidates = yield data_1.Post.find({
                    where: {
                        isPaid: false,
                        createdAt: (0, typeorm_1.LessThan)(freeLimit)
                    }
                });
                for (const post of freeCandidates) {
                    try {
                        yield this.hardDeletePost(post);
                        totalDeleted++;
                    }
                    catch (e) {
                        console.error(`Error purgando post gratis ${post.id}:`, e);
                    }
                }
            }
            // --- FASE 2: POSTS PAGADOS (ABANDONO) ---
            if (type === 'ALL' || type === 'PAID') {
                const paidRetentionDays = settings.paidPostsRetentionDays || 90;
                const paidLimit = new Date();
                paidLimit.setDate(paidLimit.getDate() - paidRetentionDays);
                const paidCandidates = yield data_1.Post.find({
                    where: {
                        isPaid: true,
                        createdAt: (0, typeorm_1.LessThan)(paidLimit)
                    },
                    relations: ["user"]
                });
                const userInactivityMonths = settings.paidPurgeInactivityMonths || 6;
                const abandonmentThreshold = new Date();
                abandonmentThreshold.setMonth(abandonmentThreshold.getMonth() - userInactivityMonths);
                const userAbandonmentCache = new Map();
                for (const post of paidCandidates) {
                    if (!post.user)
                        continue;
                    const userId = post.user.id;
                    if (!userAbandonmentCache.has(userId)) {
                        const latestSub = yield data_1.Subscription.findOne({
                            where: { user: { id: userId } },
                            order: { endDate: "DESC" }
                        });
                        // Si no tiene NINGUNA suscripción, está abandonado
                        if (!latestSub) {
                            userAbandonmentCache.set(userId, true);
                        }
                        else {
                            // Si tiene suscripción, solo está abandonado si la fecha de fin existe Y es anterior al umbral
                            // Si endDate es NULL, asumimos que NO está abandonado (suscripción activa/especial)
                            const isAbandoned = latestSub.endDate ? latestSub.endDate < abandonmentThreshold : false;
                            userAbandonmentCache.set(userId, isAbandoned);
                        }
                    }
                    if (userAbandonmentCache.get(userId)) {
                        try {
                            yield this.hardDeletePost(post);
                            totalDeleted++;
                        }
                        catch (e) {
                            console.error(`Error purgando post pagado ${post.id}:`, e);
                        }
                    }
                }
            }
            console.log(`[INTELLIGENT-PURGE] [Type: ${type}] Ejecución completada. Total eliminados: ${totalDeleted}`);
            return { deletedCount: totalDeleted };
        });
    }
    autoPurgeOldPosts() {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.executeIntelligentPurge('ALL');
        });
    }
    purgeOldPosts(adminId_1, pin_1) {
        return __awaiter(this, arguments, void 0, function* (adminId, pin, type = 'ALL') {
            const isPinValid = yield this.globalSettingsService.validateMasterPin(pin);
            if (!isPinValid)
                throw domain_1.CustomError.badRequest("El PIN Maestro ingresado es incorrecto.");
            const result = yield this.executeIntelligentPurge(type);
            console.log(`[PURGE] Admin ${adminId} executed mass ${type} purge. Deleted: ${result.deletedCount}`);
            return result;
        });
    }
    /**
     * Obtiene el conteo de posts que serían eliminados en una purga
     */
    getPurgePreview() {
        return __awaiter(this, arguments, void 0, function* (type = 'ALL') {
            const settings = yield this.globalSettingsService.getSettings();
            let count = 0;
            // --- CONTEO GRATUITOS ---
            if (type === 'ALL' || type === 'FREE') {
                const freeRetentionDays = settings.postsRetentionDays || 30;
                const freeLimit = new Date();
                freeLimit.setDate(freeLimit.getDate() - freeRetentionDays);
                count += yield data_1.Post.count({
                    where: {
                        isPaid: false,
                        createdAt: (0, typeorm_1.LessThan)(freeLimit)
                    }
                });
            }
            // --- CONTEO PAGADOS (ABANDONO) ---
            if (type === 'ALL' || type === 'PAID') {
                const paidRetentionDays = settings.paidPostsRetentionDays || 90;
                const paidLimit = new Date();
                paidLimit.setDate(paidLimit.getDate() - paidRetentionDays);
                const paidCandidates = yield data_1.Post.find({
                    where: {
                        isPaid: true,
                        createdAt: (0, typeorm_1.LessThan)(paidLimit)
                    },
                    relations: ["user"]
                });
                const userInactivityMonths = settings.paidPurgeInactivityMonths || 6;
                const abandonmentThreshold = new Date();
                abandonmentThreshold.setMonth(abandonmentThreshold.getMonth() - userInactivityMonths);
                const userAbandonmentCache = new Map();
                for (const post of paidCandidates) {
                    if (!post.user)
                        continue;
                    const userId = post.user.id;
                    if (!userAbandonmentCache.has(userId)) {
                        const latestSub = yield data_1.Subscription.findOne({
                            where: { user: { id: userId } },
                            order: { endDate: "DESC" }
                        });
                        if (!latestSub) {
                            userAbandonmentCache.set(userId, true);
                        }
                        else {
                            // Solo abandonado si tiene fecha y es vieja. Si es NULL, no se purga.
                            const isAbandoned = latestSub.endDate ? latestSub.endDate < abandonmentThreshold : false;
                            userAbandonmentCache.set(userId, isAbandoned);
                        }
                    }
                    if (userAbandonmentCache.get(userId)) {
                        count++;
                    }
                }
            }
            return { count };
        });
    }
    //ADMINISTRADOR
    // Cuenta posts pagados activos (autor con suscripción vigente)
    countActivePaidPosts() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // 1) Traer solo lo necesario: id del post y del usuario
                const paidPosts = yield data_1.Post.createQueryBuilder("post")
                    .leftJoin("post.user", "user")
                    .select(["post.id", "user.id"])
                    .where("post.statusPost = :status", { status: data_1.StatusPost.PUBLISHED })
                    .andWhere("post.isPaid = :isPaid", { isPaid: true })
                    .getMany();
                if (paidPosts.length === 0)
                    return 0;
                // 2) Evitar llamadas repetidas: chequear suscripción por usuario único
                const uniqueUserIds = Array.from(new Set(paidPosts.map((p) => { var _a; return (_a = p.user) === null || _a === void 0 ? void 0 : _a.id; }).filter(Boolean)));
                const activeUsers = yield Promise.all(uniqueUserIds.map((uid) => __awaiter(this, void 0, void 0, function* () {
                    return ({
                        uid,
                        active: yield this.subscriptionService.hasActiveSubscription(uid),
                    });
                })));
                const activeUserSet = new Set(activeUsers.filter((u) => u.active).map((u) => u.uid));
                // 3) Contar solo posts cuyo autor tenga suscripción activa
                const total = paidPosts.reduce((acc, p) => (p.user && activeUserSet.has(p.user.id) ? acc + 1 : acc), 0);
                return total;
            }
            catch (error) {
                throw domain_1.CustomError.internalServer("Error al contar posts pagados activos");
            }
        });
    }
    // Cantidad de posts pagados activos publicados en las últimas 24 horas
    countActivePaidPostsLast24h() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
                // Trae solo lo necesario: id del post y del usuario
                const posts = yield data_1.Post.createQueryBuilder("post")
                    .leftJoinAndSelect("post.user", "user")
                    .select(["post.id", "user.id"])
                    .where("post.statusPost = :status", { status: data_1.StatusPost.PUBLISHED })
                    .andWhere("post.isPaid = :isPaid", { isPaid: true })
                    .andWhere("post.createdAt >= :since", { since })
                    .getMany();
                if (posts.length === 0)
                    return 0;
                // Verifica suscripción activa por usuario único
                const uniqueUserIds = Array.from(new Set(posts.map((p) => { var _a; return (_a = p.user) === null || _a === void 0 ? void 0 : _a.id; }).filter(Boolean)));
                const results = yield Promise.all(uniqueUserIds.map((uid) => __awaiter(this, void 0, void 0, function* () {
                    return ({
                        uid,
                        active: yield this.subscriptionService.hasActiveSubscription(uid),
                    });
                })));
                const activeUserSet = new Set(results.filter((r) => r.active).map((r) => r.uid));
                // Cuenta solo los posts cuyo autor tenga suscripción activa
                const total = posts.reduce((acc, p) => (p.user && activeUserSet.has(p.user.id) ? acc + 1 : acc), 0);
                return total;
            }
            catch (error) {
                throw domain_1.CustomError.internalServer("Error al contar posts pagados activos de las últimas 24 horas");
            }
        });
    }
    // Cantidad de posts gratuitos publicados (no expirados)
    countFreePublishedPosts() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const now = new Date();
                const total = yield data_1.Post.createQueryBuilder("post")
                    .where("post.statusPost = :status", { status: data_1.StatusPost.PUBLISHED })
                    .andWhere("post.isPaid = :isPaid", { isPaid: false })
                    .andWhere("(post.expiresAt IS NULL OR post.expiresAt > :now)", { now })
                    .getCount();
                return total;
            }
            catch (error) {
                throw domain_1.CustomError.internalServer("Error al contar posts gratuitos publicados");
            }
        });
    }
    // Dentro de la clase PostService
    findPostByIdAdmin(postId) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c;
            try {
                if (!postId || !(0, uuid_1.validate)(postId)) {
                    throw domain_1.CustomError.badRequest("ID de post inválido");
                }
                const post = yield data_1.Post.findOne({
                    where: { id: postId },
                    relations: ["user"],
                    select: {
                        user: {
                            id: true,
                            name: true,
                            surname: true,
                            photoperfil: true,
                            whatsapp: true,
                            email: true,
                        },
                    },
                });
                if (!post)
                    throw domain_1.CustomError.notFound("Post no encontrado");
                // Resolver imágenes del post y la foto de perfil del usuario (si existen)
                const [imgs, userImage] = yield Promise.all([
                    Promise.all(((_a = post.imgpost) !== null && _a !== void 0 ? _a : []).map((key) => upload_files_cloud_adapter_1.UploadFilesCloud.getFile({
                        bucketName: config_1.envs.AWS_BUCKET_NAME,
                        key,
                    }).catch(() => null) // tolerante a errores de archivos faltantes
                    )),
                    ((_b = post.user) === null || _b === void 0 ? void 0 : _b.photoperfil)
                        ? upload_files_cloud_adapter_1.UploadFilesCloud.getFile({
                            bucketName: config_1.envs.AWS_BUCKET_NAME,
                            key: post.user.photoperfil,
                        }).catch(() => null)
                        : null,
                ]);
                return {
                    id: post.id,
                    title: post.title,
                    subtitle: post.subtitle,
                    content: post.content,
                    statusPost: post.statusPost,
                    isPaid: post.isPaid,
                    createdAt: post.createdAt,
                    expiresAt: post.expiresAt,
                    totalLikes: (_c = post.likesCount) !== null && _c !== void 0 ? _c : 0,
                    imgpost: (imgs !== null && imgs !== void 0 ? imgs : []).filter(Boolean),
                    user: {
                        id: post.user.id,
                        name: post.user.name,
                        surname: post.user.surname,
                        whatsapp: post.user.whatsapp,
                        photoperfil: userImage,
                        email: post.user.email,
                    },
                };
            }
            catch (error) {
                if (error instanceof domain_1.CustomError)
                    throw error;
                throw domain_1.CustomError.internalServer("Error buscando el post por ID (admin)");
            }
        });
    }
    // ADMINISTRADOR - Bloquear post
    // ADMINISTRADOR - Bloquear/Desbloquear (toggle)
    blockPostAdmin(postId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                if (!postId || !(0, uuid_1.validate)(postId)) {
                    throw domain_1.CustomError.badRequest("ID de post inválido");
                }
                const post = yield data_1.Post.findOne({ where: { id: postId } });
                if (!post)
                    throw domain_1.CustomError.notFound("Post no encontrado");
                // Toggle: si está bloqueado -> PUBLISHED; si no, FLAGGED
                const wasBlocked = post.statusPost === data_1.StatusPost.FLAGGED;
                post.statusPost = wasBlocked
                    ? data_1.StatusPost.PUBLISHED
                    : data_1.StatusPost.FLAGGED;
                yield post.save();
                (0, socket_1.getIO)().emit("postChanged", { action: "update", postId: post.id, status: post.statusPost });
                return {
                    message: wasBlocked ? "Post desbloqueado" : "Post bloqueado",
                    status: post.statusPost
                };
            }
            catch (error) {
                throw domain_1.CustomError.internalServer("Error toggling block");
            }
        });
    }
    // ADMIN: Cambiar estado explícito
    changeStatusPostAdmin(postId, status) {
        return __awaiter(this, void 0, void 0, function* () {
            const post = yield data_1.Post.findOne({ where: { id: postId } });
            if (!post)
                throw domain_1.CustomError.notFound("Post no encontrado");
            post.statusPost = status;
            yield post.save();
            (0, socket_1.getIO)().emit("postChanged", { action: "update", postId: post.id, status: post.statusPost });
            return { message: `Estado cambiado a ${status}`, status: post.statusPost };
        });
    }
    // ADMIN: Purga definitiva
    purgePostAdmin(postId) {
        return __awaiter(this, void 0, void 0, function* () {
            const post = yield data_1.Post.findOne({ where: { id: postId } });
            if (!post)
                throw domain_1.CustomError.notFound("Post no encontrado");
            return yield this.hardDeletePost(post);
        });
    }
    expirePosts() {
        return __awaiter(this, void 0, void 0, function* () {
            const now = new Date();
            try {
                const expiredPosts = yield data_1.Post.createQueryBuilder("post")
                    .where("post.statusPost = :status", { status: data_1.StatusPost.PUBLISHED })
                    .andWhere("post.isPaid = false")
                    .andWhere("post.expiresAt <= :now", { now })
                    .getMany();
                if (expiredPosts.length === 0)
                    return 0;
                let deletedCount = 0;
                for (const post of expiredPosts) {
                    yield this.hardDeletePost(post);
                    deletedCount++;
                }
                return deletedCount;
            }
            catch (error) {
                console.error("Error al expirar posts:", error);
                throw domain_1.CustomError.internalServer("Error al procesar la expiración de posts");
            }
        });
    }
    // ==========================================
    // 📅 SCHEDULED POSTS METHODS
    // ==========================================
    getScheduledPostsByUser(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            const posts = yield data_1.Post.find({
                where: { user: { id: userId }, statusPost: data_1.StatusPost.SCHEDULED },
                order: { scheduledAt: "ASC" },
            });
            return Promise.all(posts.map((post) => __awaiter(this, void 0, void 0, function* () {
                var _a;
                const imgs = yield Promise.all(((_a = post.imgpost) !== null && _a !== void 0 ? _a : []).map((img) => upload_files_cloud_adapter_1.UploadFilesCloud.getFile({
                    bucketName: config_1.envs.AWS_BUCKET_NAME,
                    key: img,
                }).catch(() => null)));
                return Object.assign(Object.assign({}, post), { imgpost: imgs.filter(i => i) });
            })));
        });
    }
    cancelScheduledPost(id, userId) {
        return __awaiter(this, void 0, void 0, function* () {
            const post = yield data_1.Post.findOne({ where: { id, user: { id: userId } } });
            if (!post)
                throw domain_1.CustomError.notFound("Post programado no encontrado");
            if (post.statusPost !== data_1.StatusPost.SCHEDULED) {
                throw domain_1.CustomError.badRequest("Solo se pueden cancelar publicaciones programadas");
            }
            post.statusPost = data_1.StatusPost.CANCELLED;
            yield post.save();
            (0, socket_1.getIO)().emit("postChanged", { action: "cancel", postId: id });
            return { message: "Publicación programada cancelada" };
        });
    }
    processScheduledPosts() {
        return __awaiter(this, void 0, void 0, function* () {
            const now = new Date();
            const scheduledPosts = yield data_1.Post.createQueryBuilder("post")
                .leftJoinAndSelect("post.user", "user")
                .where("post.statusPost = :status", { status: data_1.StatusPost.SCHEDULED })
                .andWhere("post.scheduledAt <= :now", { now })
                .getMany();
            if (scheduledPosts.length === 0)
                return;
            for (const post of scheduledPosts) {
                try {
                    // Validar si el usuario sigue teniendo suscripción activa
                    const hasSub = yield this.subscriptionService.hasActiveSubscription(post.user.id);
                    if (!hasSub) {
                        post.statusPost = data_1.StatusPost.FAILED;
                        // Tal vez añadir una observación
                        yield post.save();
                        continue;
                    }
                    post.statusPost = data_1.StatusPost.PUBLISHED;
                    post.publishedAt = new Date();
                    post.createdAt = new Date(); // Actualizamos createdAt para que aparezca arriba en el feed
                    yield post.save();
                    // Emitir evento de publicación
                    (0, socket_1.getIO)().emit("postChanged", { action: "published", post });
                    console.log(`✅ Post ${post.id} publicado automáticamente.`);
                }
                catch (error) {
                    console.error(`❌ Error procesando post programado ${post.id}:`, error);
                    post.statusPost = data_1.StatusPost.FAILED;
                    yield post.save();
                }
            }
        });
    }
    updateScheduledPost(id, userId, data) {
        return __awaiter(this, void 0, void 0, function* () {
            const post = yield data_1.Post.findOne({ where: { id, user: { id: userId } } });
            if (!post)
                throw domain_1.CustomError.notFound("Post programado no encontrado");
            if (post.statusPost !== data_1.StatusPost.SCHEDULED) {
                throw domain_1.CustomError.badRequest("Solo se pueden editar publicaciones programadas");
            }
            if (data.content)
                post.content = data.content;
            if (data.scheduledAt) {
                const scheduledDate = new Date(data.scheduledAt);
                const now = new Date();
                if (scheduledDate < new Date(now.getTime() + 55 * 60 * 1000)) {
                    throw domain_1.CustomError.badRequest("La nueva fecha debe ser al menos 1 hora en el futuro");
                }
                post.scheduledAt = scheduledDate;
            }
            yield post.save();
            return post;
        });
    }
}
exports.PostService = PostService;
