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
exports.PostService = void 0;
// src/presentation/services/post.service.ts
const typeorm_1 = require("typeorm");
const config_1 = require("../../config");
const socket_1 = require("../../config/socket");
const upload_files_cloud_adapter_1 = require("../../config/upload-files-cloud-adapter");
const data_1 = require("../../data");
const domain_1 = require("../../domain");
const uuid_1 = require("uuid");
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
                    .where("post.statusPost = :status", { status: data_1.StatusPost.PUBLICADO })
                    .andWhere("(post.isPaid = true OR (post.expiresAt IS NULL OR post.expiresAt > :now))", { now })
                    .orderBy("post.createdAt", "DESC")
                    .skip(skip)
                    .take(limit);
                const [posts, total] = yield query.getManyAndCount();
                // Filtrar los posts pagados cuyo autor no tiene suscripción activa
                const filteredPosts = yield Promise.all(posts.map((post) => __awaiter(this, void 0, void 0, function* () {
                    if (post.isPaid) {
                        const hasSubscription = yield this.subscriptionService.hasActiveSubscription(post.user.id);
                        return hasSubscription ? post : null;
                    }
                    return post; // Los gratuitos se mantienen
                })));
                // Limpiar nulos (posts eliminados)
                const validPosts = filteredPosts.filter((p) => p !== null);
                // 2. Procesar posts expirados en segundo plano
                this.processExpiredPosts().catch((error) => {
                    console.error("Error al procesar posts expirados:", error);
                });
                // 3. Procesamiento optimizado de imágenes + CHECK LIKES
                const formattedPosts = yield Promise.all(validPosts.map((post) => __awaiter(this, void 0, void 0, function* () {
                    var _a, _b, _c;
                    const [imgs, userImage, isLiked] = yield Promise.all([
                        Promise.all(((_a = post.imgpost) !== null && _a !== void 0 ? _a : []).map((img) => upload_files_cloud_adapter_1.UploadFilesCloud.getOptimizedUrls({
                            bucketName: config_1.envs.AWS_BUCKET_NAME,
                            key: img,
                        }))),
                        ((_b = post.user) === null || _b === void 0 ? void 0 : _b.photoperfil)
                            ? upload_files_cloud_adapter_1.UploadFilesCloud.getOptimizedUrls({
                                bucketName: config_1.envs.AWS_BUCKET_NAME,
                                key: post.user.photoperfil,
                            })
                            : null,
                        userId
                            ? data_1.Like.findOne({
                                where: { post: { id: post.id }, user: { id: userId } },
                            }).then((like) => !!like)
                            : Promise.resolve(false),
                    ]);
                    return Object.assign(Object.assign({}, post), { imgpost: imgs, user: {
                            id: post.user.id,
                            name: post.user.name,
                            surname: post.user.surname,
                            whatsapp: post.user.whatsapp,
                            photoperfil: userImage,
                        }, totalLikes: (_c = post.likesCount) !== null && _c !== void 0 ? _c : 0, isLiked });
                })));
                return {
                    total,
                    totalPages: Math.ceil(total / limit),
                    currentPage: page,
                    posts: formattedPosts,
                };
            }
            catch (error) {
                throw domain_1.CustomError.internalServer("Error al obtener posts paginados");
            }
        });
    }
    // Método para manejar posts expirados
    processExpiredPosts() {
        return __awaiter(this, void 0, void 0, function* () {
            const now = new Date();
            // Buscar posts públicos gratuitos que hayan expirado
            const expiredPosts = yield data_1.Post.createQueryBuilder("post")
                .where("post.statusPost = :status", { status: data_1.StatusPost.PUBLICADO })
                .andWhere("post.isPaid = false")
                .andWhere("post.expiresAt <= :now", { now })
                .getMany();
            if (expiredPosts.length > 0) {
                // Actualizar todos los posts expirados en una sola operación
                yield data_1.Post.createQueryBuilder()
                    .update()
                    .set({ statusPost: data_1.StatusPost.ELIMINADO })
                    .whereInIds(expiredPosts.map((p) => p.id))
                    .execute();
                // Emitir eventos de socket para cada post eliminado
                expiredPosts.forEach((post) => {
                    (0, socket_1.getIO)().emit("postChanged", {
                        action: "delete",
                        postId: post.id,
                    });
                });
            }
        });
    }
    searchPost(searchTerm, userId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const posts = yield data_1.Post.find({
                    where: [
                        { title: (0, typeorm_1.ILike)(`%${searchTerm}%`) },
                        { subtitle: (0, typeorm_1.ILike)(`%${searchTerm}%`) },
                        { user: { name: (0, typeorm_1.ILike)(`%${searchTerm}%`) } },
                        { user: { surname: (0, typeorm_1.ILike)(`%${searchTerm}%`) } },
                    ],
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
                    order: { createdAt: "DESC" },
                });
                // Resolviendo imágenes + LIKES
                const resolvedPosts = yield Promise.all(posts.map((post) => __awaiter(this, void 0, void 0, function* () {
                    var _a;
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
                })));
                return resolvedPosts;
            }
            catch (error) {
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
                // Configurar expiración para posts gratuitos
                if (!post.isPaid && freePostTracker && settings) {
                    const durationMs = (settings.freePostDurationDays * 24 * 60 * 60 * 1000) +
                        (settings.freePostDurationHours * 60 * 60 * 1000);
                    post.expiresAt = new Date(Date.now() + durationMs);
                    post.freePostTracker = freePostTracker;
                }
                else if (!post.isPaid) {
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
                    showWhatsApp: postSaved.showWhatsApp,
                    showLikes: postSaved.showLikes,
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
                    action: "create",
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
    deleteExpiredPosts() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // 1. Buscar posts gratuitos expirados (ELIMINADOS o con expiresAt pasado)
                const expiredPosts = yield data_1.Post.find({
                    where: [
                        { statusPost: data_1.StatusPost.ELIMINADO }, // Posts ya marcados como eliminados
                        {
                            isPaid: false,
                            expiresAt: (0, typeorm_1.LessThan)(new Date()), // Posts gratuitos que ya expiraron
                        },
                    ],
                    relations: ["user"], // Opcional: si necesitas info del usuario
                });
                if (expiredPosts.length === 0) {
                    return { deletedCount: 0 };
                }
                let deletedCount = 0;
                // 2. Procesar cada post para borrado permanente
                for (const post of expiredPosts) {
                    try {
                        // 2.1. Eliminar imágenes de AWS si existen
                        if (post.imgpost && post.imgpost.length > 0) {
                            yield Promise.all(post.imgpost.map((key) => upload_files_cloud_adapter_1.UploadFilesCloud.deleteFile({
                                bucketName: config_1.envs.AWS_BUCKET_NAME,
                                key: key,
                            }).catch((error) => console.error(`Error al borrar imagen ${key}:`, error))));
                        }
                        // 2.2. Borrar el post de la base de datos (hard delete)
                        yield data_1.Post.remove(post);
                        deletedCount++;
                    }
                    catch (postError) {
                        console.error(`Error procesando post ${post.id}:`, postError);
                        continue; // Continuar con el siguiente post si falla uno
                    }
                }
                // 3. Emitir evento para actualizar clients (opcional)
                (0, socket_1.getIO)().emit("postsCleaned", { count: deletedCount });
                return { deletedCount };
            }
            catch (error) {
                console.error("Error en deleteExpiredPosts:", error);
                throw domain_1.CustomError.internalServer("Error al limpiar posts expirados");
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
                    skip: skip,
                    withDeleted: true // Include soft deleted logic if implemented with @DeleteDateColumn
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
            return post.statusPost === data_1.StatusPost.ELIMINADO
                ? yield this.hardDeletePost(post)
                : yield this.softDeletePost(post);
        });
    }
    softDeletePost(post) {
        return __awaiter(this, void 0, void 0, function* () {
            post.statusPost = data_1.StatusPost.ELIMINADO;
            post.deletedAt = new Date();
            yield post.save();
            (0, socket_1.getIO)().emit("postChanged", {
                action: "delete",
                postId: post.id,
            });
            return { message: "Post marcado como eliminado" };
        });
    }
    hardDeletePost(post) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            if (((_a = post.imgpost) === null || _a === void 0 ? void 0 : _a.length) > 0) {
                yield Promise.all(post.imgpost.map((key) => upload_files_cloud_adapter_1.UploadFilesCloud.deleteFile({
                    bucketName: config_1.envs.AWS_BUCKET_NAME,
                    key: key,
                })));
            }
            yield data_1.Post.remove(post);
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
    // 🛡️ ADMIN METHODS (Advanced Management)
    // ==========================================
    getAdminStats() {
        return __awaiter(this, void 0, void 0, function* () {
            const totalPosts = yield data_1.Post.count({ withDeleted: true });
            const activePosts = yield data_1.Post.count({ where: { statusPost: data_1.StatusPost.PUBLICADO } });
            const deletedPosts = yield data_1.Post.count({ where: { statusPost: data_1.StatusPost.ELIMINADO }, withDeleted: true });
            const paidPosts = yield data_1.Post.count({ where: { isPaid: true }, withDeleted: true });
            const freePosts = yield data_1.Post.count({ where: { isPaid: false }, withDeleted: true });
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            const last30Days = yield data_1.Post.count({ where: { createdAt: (0, typeorm_1.MoreThan)(thirtyDaysAgo) }, withDeleted: true });
            return {
                totalPosts,
                activePosts,
                deletedPosts,
                paidPosts,
                freePosts,
                last30Days,
                revenue: 0 // Placeholder
            };
        });
    }
    purgeOldDeletedPosts() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const thirtyDaysAgo = new Date();
                thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
                const postsToPurge = yield data_1.Post.createQueryBuilder("post")
                    .withDeleted()
                    .where("post.statusPost = :status", { status: data_1.StatusPost.ELIMINADO })
                    .andWhere("post.deletedAt <= :threshold", { threshold: thirtyDaysAgo })
                    .getMany();
                if (postsToPurge.length === 0)
                    return { deletedCount: 0 };
                let deletedCount = 0;
                for (const post of postsToPurge) {
                    yield this.hardDeletePost(post);
                    deletedCount++;
                }
                return { deletedCount };
            }
            catch (error) {
                console.error("Purge Error", error);
                throw domain_1.CustomError.internalServer("Error purging posts");
            }
        });
    }
    getAdminPosts(filters_1) {
        return __awaiter(this, arguments, void 0, function* (filters, page = 1, limit = 20) {
            const { id, status, type, startDate, endDate } = filters;
            const query = data_1.Post.createQueryBuilder("post")
                .leftJoinAndSelect("post.user", "user")
                .withDeleted()
                .orderBy("post.createdAt", "DESC")
                .skip((page - 1) * limit)
                .take(limit);
            if (id) {
                query.andWhere("post.id = :id", { id });
            }
            if (status) {
                query.andWhere("post.statusPost = :status", { status });
            }
            if (type) {
                const isPaid = type === 'PAGADO';
                query.andWhere("post.isPaid = :isPaid", { isPaid });
            }
            if (startDate && endDate) {
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                query.andWhere("post.createdAt BETWEEN :start AND :end", { start: startDate, end });
            }
            const [posts, total] = yield query.getManyAndCount();
            const formattedPosts = yield Promise.all(posts.map((post) => __awaiter(this, void 0, void 0, function* () {
                var _a, _b;
                const resolvedImgs = yield Promise.all(((_a = post.imgpost) !== null && _a !== void 0 ? _a : []).map((img) => upload_files_cloud_adapter_1.UploadFilesCloud.getFile({
                    bucketName: config_1.envs.AWS_BUCKET_NAME,
                    key: img,
                }).catch(() => null)));
                const userImage = ((_b = post.user) === null || _b === void 0 ? void 0 : _b.photoperfil)
                    ? yield upload_files_cloud_adapter_1.UploadFilesCloud.getFile({ bucketName: config_1.envs.AWS_BUCKET_NAME, key: post.user.photoperfil }).catch(() => null)
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
    //ADMINISTRADOR
    // Cuenta posts pagados activos (autor con suscripción vigente)
    countActivePaidPosts() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // 1) Traer solo lo necesario: id del post y del usuario
                const paidPosts = yield data_1.Post.createQueryBuilder("post")
                    .leftJoin("post.user", "user")
                    .select(["post.id", "user.id"])
                    .where("post.statusPost = :status", { status: data_1.StatusPost.PUBLICADO })
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
                    .where("post.statusPost = :status", { status: data_1.StatusPost.PUBLICADO })
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
                    .where("post.statusPost = :status", { status: data_1.StatusPost.PUBLICADO })
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
                // Toggle: si está bloqueado -> PUBLICADO; si no, BLOQUEADO
                const wasBlocked = post.statusPost === data_1.StatusPost.BLOQUEADO;
                post.statusPost = wasBlocked
                    ? data_1.StatusPost.PUBLICADO
                    : data_1.StatusPost.BLOQUEADO;
                yield post.save();
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
            if (status === data_1.StatusPost.ELIMINADO) {
                post.deletedAt = new Date();
            }
            else {
                post.deletedAt = null;
            }
            yield post.save();
            (0, socket_1.getIO)().emit("postChanged", { action: "update", postId: post.id });
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
    // ADMINISTRADOR - Borrar permanentemente posts ELIMINADO (> 3 días) y sus imágenes
    purgeDeletedPostsOlderThan3Days() {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                const cutoff = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
                // Buscar posts ELIMINADO con deletedAt <= cutoff
                const posts = yield data_1.Post.find({
                    where: {
                        statusPost: data_1.StatusPost.ELIMINADO,
                        deletedAt: (0, typeorm_1.LessThan)(cutoff),
                    },
                });
                if (posts.length === 0) {
                    return { deletedCount: 0 };
                }
                let deletedCount = 0;
                for (const post of posts) {
                    try {
                        // 1) Borrar imágenes en AWS (si existen)
                        if ((_a = post.imgpost) === null || _a === void 0 ? void 0 : _a.length) {
                            yield Promise.all(post.imgpost.map((key) => upload_files_cloud_adapter_1.UploadFilesCloud.deleteFile({
                                bucketName: config_1.envs.AWS_BUCKET_NAME,
                                key,
                            }).catch(() => undefined) // tolerante a fallos
                            ));
                        }
                        // 2) Borrado permanente en BD
                        yield data_1.Post.remove(post);
                        deletedCount++;
                    }
                    catch (_b) {
                        continue; // si falla un post, sigue con el siguiente
                    }
                }
                return { deletedCount };
            }
            catch (_c) {
                throw domain_1.CustomError.internalServer("Error al purgar posts eliminados mayores a 3 días");
            }
        });
    }
    expirePosts() {
        return __awaiter(this, void 0, void 0, function* () {
            const now = new Date();
            try {
                const result = yield data_1.Post.createQueryBuilder()
                    .update(data_1.Post)
                    .set({
                    statusPost: data_1.StatusPost.ELIMINADO,
                    expiresAt: null,
                    deletedAt: now
                })
                    .where("statusPost = :status", { status: data_1.StatusPost.PUBLICADO })
                    .andWhere("isPaid = :isPaid", { isPaid: false })
                    .andWhere("expiresAt <= :now", { now })
                    .execute();
                return result.affected || 0;
            }
            catch (error) {
                console.error("Error al expirar posts:", error);
                throw domain_1.CustomError.internalServer("Error al procesar la expiración de posts");
            }
        });
    }
}
exports.PostService = PostService;
