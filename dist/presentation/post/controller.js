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
exports.PostController = void 0;
const domain_1 = require("../../domain");
class PostController {
    constructor(postService) {
        this.postService = postService;
        this.handleError = (error, res) => {
            if (error instanceof domain_1.CustomError) {
                return res.status(error.statusCode).json({ message: error.message });
            }
            console.error("Unhandled error:", error);
            return res.status(500).json({ message: "Something went very wrong" });
        };
        //revisado y aprobado
        this.createPostPlan = (req, res) => {
            var _a;
            const { title, subtitle, content, isPaid, showWhatsApp, showLikes } = req.body;
            const userId = ((_a = req.body.sessionUser) === null || _a === void 0 ? void 0 : _a.id) || req.body.userId;
            if (!userId || !this.isValidUUID(userId)) {
                return res.status(400).json({ message: "ID de usuario inválido o no proporcionado" });
            }
            // Convertir isPaid a booleano correctamente
            const isPaidBool = isPaid === "true" || isPaid === true;
            const showWhatsAppBool = showWhatsApp === "true" || showWhatsApp === true || showWhatsApp === undefined;
            const showLikesBool = showLikes === "true" || showLikes === true || showLikes === undefined;
            this.postService
                .createPostPlan({
                userId,
                title,
                subtitle,
                content,
                isPaid: isPaidBool,
                showWhatsApp: showWhatsAppBool,
                showLikes: showLikesBool,
            }, req.files)
                .then((data) => res.status(201).json(data))
                .catch((error) => this.handleError(error, res));
        };
        this.findAllPostPaginated = (req, res) => {
            var _a;
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 10;
            const userId = (_a = req.body.sessionUser) === null || _a === void 0 ? void 0 : _a.id;
            if (page <= 0 || limit <= 0) {
                return res.status(400).json({
                    message: "Los parámetros 'page' y 'limit' deben ser números positivos.",
                });
            }
            this.postService
                .findAllPostPaginated(page, limit, userId)
                .then((data) => res.status(200).json(data))
                .catch((error) => this.handleError(error, res));
        };
        this.findOnePost = (req, res) => {
            var _a;
            const { id } = req.params;
            const userId = (_a = req.body.sessionUser) === null || _a === void 0 ? void 0 : _a.id;
            this.postService
                .findOnePost(id, userId)
                .then((data) => {
                res.status(201).json(data);
            })
                .catch((error) => this.handleError(error, res));
        };
        this.getPostsByUser = (req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                // Verificación más estricta del usuario de sesión
                const sessionUser = req.body.sessionUser;
                if (!(sessionUser === null || sessionUser === void 0 ? void 0 : sessionUser.id)) {
                    return res.status(401).json({
                        success: false,
                        message: "Usuario no autenticado o sesión inválida",
                    });
                }
                // Validación de UUID
                if (!this.isValidUUID(sessionUser.id)) {
                    return res.status(400).json({
                        success: false,
                        message: "ID de usuario no válido",
                    });
                }
                const page = parseInt(req.query.page) || 1;
                const data = yield this.postService.getPostsByUser(sessionUser.id, page);
                res.status(200).json(Object.assign({ success: true }, data));
            }
            catch (error) {
                this.handleError(error, res);
            }
        });
        this.updatePostDate = (req, res) => __awaiter(this, void 0, void 0, function* () {
            var _a;
            const { id: postId } = req.params;
            const userId = (_a = req.body.sessionUser) === null || _a === void 0 ? void 0 : _a.id;
            if (!userId) {
                return res.status(401).json({ message: "Usuario no autenticado" });
            }
            if (!this.isValidUUID(userId)) {
                return res.status(400).json({ message: "ID de usuario no válido" });
            }
            try {
                const result = yield this.postService.updatePostDate(postId, userId);
                return res.status(200).json(result);
            }
            catch (error) {
                return this.handleError(error, res);
            }
        });
        this.deletePost = (req, res) => {
            var _a;
            const { id } = req.params;
            const userId = (_a = req.body.sessionUser) === null || _a === void 0 ? void 0 : _a.id;
            if (!userId) {
                return res.status(401).json({ message: "Unauthorized" });
            }
            this.postService
                .deletePost(id, userId)
                .then((result) => res.status(200).json(result))
                .catch((error) => this.handleError(error, res));
        };
        this.updatePost = (req, res) => __awaiter(this, void 0, void 0, function* () {
            const { id } = req.params;
            // Creamos el DTO con los datos enviados (todos opcionales)
            const [, updatePostDto] = domain_1.UpdateDTO.create(req.body);
            try {
                const postActualizado = yield this.postService.updatePost(id, updatePostDto);
                res.status(200).json(postActualizado);
            }
            catch (error) {
                this.handleError(error, res);
            }
        });
        this.searchPost = (req, res) => {
            var _a;
            const { searchTerm } = req.query;
            const userId = (_a = req.body.sessionUser) === null || _a === void 0 ? void 0 : _a.id;
            if (!searchTerm || typeof searchTerm !== "string") {
                return res
                    .status(400)
                    .json({ message: "Debe proporcionar un término de búsqueda" });
            }
            this.postService
                .searchPost(searchTerm, userId)
                .then((data) => {
                res.status(200).json(data);
            })
                .catch((error) => this.handleError(error, res));
        };
        //ADMINISTRADOR
        // Total de posts pagados activos (estatus PUBLICADO + autor con suscripción activa)
        this.countActivePaidPosts = (_req, res) => {
            this.postService
                .countActivePaidPosts()
                .then((total) => res.status(200).json({
                success: true,
                total,
            }))
                .catch((error) => this.handleError(error, res));
        };
        // Total de posts pagados activos en las últimas 24h
        this.countActivePaidPostsLast24h = (_req, res) => {
            this.postService
                .countActivePaidPostsLast24h()
                .then((total) => res.status(200).json({
                success: true,
                total,
            }))
                .catch((error) => this.handleError(error, res));
        };
        // Cantidad de posts gratuitos publicados (vigentes)
        this.countFreePublishedPosts = (_req, res) => {
            this.postService
                .countFreePublishedPosts()
                .then((total) => res.status(200).json({
                success: true,
                total,
            }))
                .catch((error) => this.handleError(error, res));
        };
        // Dentro de la clase PostController
        // GET /api/admin/posts/search-by-id/:id   (también soporta ?id=...)
        this.getPostByIdAdmin = (req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                const id = req.params.id || req.query.id || "";
                if (!id) {
                    return res
                        .status(400)
                        .json({ message: "Debe proporcionar el ID del post" });
                }
                // Validación temprana (el service también valida, pero así respondemos más claro al admin)
                if (!this.isValidUUID(id)) {
                    return res.status(400).json({ message: "ID de post inválido" });
                }
                const post = yield this.postService.findPostByIdAdmin(id);
                return res.status(200).json({
                    success: true,
                    post,
                });
            }
            catch (error) {
                return this.handleError(error, res);
            }
        });
        // ADMIN: Get all posts for a specific user
        this.getPostsByUserAdmin = (req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                const { id } = req.params; // userId
                const page = parseInt(req.query.page) || 1;
                const limit = parseInt(req.query.limit) || 10;
                if (!id)
                    return res.status(400).json({ message: "User ID is required" });
                const data = yield this.postService.getPostsByUserAdmin(id, page, limit);
                return res.status(200).json(Object.assign({ success: true }, data));
            }
            catch (error) {
                return this.handleError(error, res);
            }
        });
        // ADMINISTRADOR - Bloquear post
        // POST /api/post/admin/:id/block
        // ADMINISTRADOR - Bloquear/Desbloquear post (toggle)
        // POST /api/post/admin/:id/block
        this.blockPostAdmin = (req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                const { id } = req.params;
                if (!id) {
                    return res
                        .status(400)
                        .json({ message: "Debe proporcionar el ID del post" });
                }
                if (!this.isValidUUID(id)) {
                    return res.status(400).json({ message: "ID de post inválido" });
                }
                const { message, status } = yield this.postService.blockPostAdmin(id);
                const action = status === "BLOQUEADO" ? "block" : "unblock";
                return res.status(200).json({
                    success: true,
                    action, // "block" | "unblock"
                    status, // nuevo estado del post
                    message, // "Post bloqueado correctamente" | "Post desbloqueado correctamente"
                });
            }
            catch (error) {
                return this.handleError(error, res);
            }
        });
        // ADMINISTRADOR - Purgar posts ELIMINADO (>3 días) y sus imágenes
        // DELETE /api/post/admin/purge-deleted
        // ADMIN: Change status explicitly
        this.changeStatusPostAdmin = (req, res) => __awaiter(this, void 0, void 0, function* () {
            const { id } = req.params;
            const { status } = req.body;
            if (!status)
                return res.status(400).json({ message: "Status is required" });
            this.postService.changeStatusPostAdmin(id, status)
                .then(data => res.status(200).json(data))
                .catch(err => this.handleError(err, res));
        });
        // ADMIN: Purge definitive
        this.purgePostAdmin = (req, res) => __awaiter(this, void 0, void 0, function* () {
            const { id } = req.params;
            this.postService.purgePostAdmin(id)
                .then(data => res.status(200).json(data))
                .catch(err => this.handleError(err, res));
        });
        // ADMINISTRADOR - Purgar posts ELIMINADO (>3 días) y sus imágenes
        // DELETE /api/post/admin/purge-deleted
        this.purgeDeletedPostsOlderThan3Days = (_req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                const { deletedCount } = yield this.postService.purgeDeletedPostsOlderThan3Days();
                return res.status(200).json({
                    success: true,
                    deletedCount,
                });
            }
            catch (error) {
                console.error("💥 Error en controlador purgeDeletedPostsOlderThan3Days:", error);
                return this.handleError(error, res);
            }
        });
        // ==========================================
        // 🛡️ ADMIN DASHBOARD METHODS
        // ==========================================
        this.getAdminStats = (_req, res) => {
            this.postService.getAdminStats()
                .then(data => res.status(200).json(data))
                .catch(error => this.handleError(error, res));
        };
        this.getAdminPosts = (req, res) => {
            const filters = {
                id: req.query.id,
                status: req.query.status,
                type: req.query.type,
                startDate: req.query.startDate,
                endDate: req.query.endDate
            };
            const page = Number(req.query.page) || 1;
            const limit = Number(req.query.limit) || 20;
            this.postService.getAdminPosts(filters, page, limit)
                .then(data => res.status(200).json(data))
                .catch(error => this.handleError(error, res));
        };
        this.purgeOldDeletedPosts = (_req, res) => {
            this.postService.purgeOldDeletedPosts()
                .then(data => res.status(200).json(data))
                .catch(error => this.handleError(error, res));
        };
    }
    isValidUUID(uuid) {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        return uuidRegex.test(uuid);
    }
}
exports.PostController = PostController;
