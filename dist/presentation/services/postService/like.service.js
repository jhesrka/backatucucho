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
exports.LikeService = void 0;
const data_1 = require("../../../data");
const domain_1 = require("../../../domain");
const socket_1 = require("../../../config/socket");
class LikeService {
    /**
     * Agrega un like a un post.
     * Maneja concurrencia y evita duplicados con la restricción de base de datos.
     */
    addLike(createLikeDto) {
        return __awaiter(this, void 0, void 0, function* () {
            const { userId, postId } = createLikeDto;
            // 1. Validaciones previas
            const post = yield data_1.Post.findOneBy({ id: postId });
            if (!post)
                throw domain_1.CustomError.notFound("Post no encontrado");
            const user = yield data_1.User.findOneBy({ id: userId });
            if (!user)
                throw domain_1.CustomError.notFound("Usuario no encontrado");
            try {
                // 2. Intentar crear el like
                // Si ya existe, fallará por la restricción UNIQUE (user_id, post_id)
                const newLike = data_1.Like.create({ user, post });
                yield newLike.save();
                // 3. Incrementar contador atómicamente
                yield data_1.Post.getRepository().increment({ id: postId }, "likesCount", 1);
                // 4. Obtener el nuevo contador para actualizar al cliente
                // Podemos confiar en que incrementó, pero para estar 100% seguros leemos o calculamos
                // Por performance, podemos devolver el valor anterior + 1, pero si queremos consistencia eventual:
                const updatedPost = yield data_1.Post.findOne({ where: { id: postId }, select: ['likesCount'] });
                const realLikes = (updatedPost === null || updatedPost === void 0 ? void 0 : updatedPost.likesCount) || 0;
                // 5. Emitir evento Websocket
                (0, socket_1.getIO)().emit("post_like_updated", {
                    postId: postId,
                    totalLikes: realLikes,
                });
                return {
                    liked: true,
                    message: "Like agregado",
                    likesCount: realLikes,
                };
            }
            catch (error) {
                // Manejo de error de duplicado (Postgres error code 23505)
                if (error.code === '23505') {
                    throw domain_1.CustomError.badRequest("Ya has dado like a este post");
                }
                throw domain_1.CustomError.internalServer("Error al dar like");
            }
        });
    }
    /**
     * Elimina un like de un post.
     */
    removeLike(postId, userId) {
        return __awaiter(this, void 0, void 0, function* () {
            const like = yield data_1.Like.findOne({
                where: {
                    post: { id: postId },
                    user: { id: userId },
                },
            });
            if (!like) {
                throw domain_1.CustomError.badRequest("No has dado like a este post");
            }
            try {
                // 1. Eliminar el like
                yield like.remove();
                // 2. Decrementar contador atómicamente
                yield data_1.Post.getRepository().decrement({ id: postId }, "likesCount", 1);
                // 3. Obtener contador actualizado
                const updatedPost = yield data_1.Post.findOne({ where: { id: postId }, select: ['likesCount'] });
                const realLikes = (updatedPost === null || updatedPost === void 0 ? void 0 : updatedPost.likesCount) || 0;
                // 4. Emitir evento Websocket
                (0, socket_1.getIO)().emit("post_like_updated", {
                    postId: postId,
                    totalLikes: realLikes,
                });
                return {
                    liked: false,
                    message: "Like eliminado",
                    likesCount: realLikes,
                };
            }
            catch (error) {
                throw domain_1.CustomError.internalServer("Error al quitar like");
            }
        });
    }
    /**
     * Devuelve el número total de likes que tiene un post.
     */
    countLikesByPost(postId) {
        return __awaiter(this, void 0, void 0, function* () {
            const post = yield data_1.Post.findOne({ where: { id: postId }, select: ['likesCount'] });
            return (post === null || post === void 0 ? void 0 : post.likesCount) || 0;
        });
    }
    /**
     * Verifica si un usuario ya dio like a un post (para frontend).
     */
    hasUserLikedPost(userId, postId) {
        return __awaiter(this, void 0, void 0, function* () {
            const like = yield data_1.Like.findOne({
                where: {
                    user: { id: userId },
                    post: { id: postId },
                },
                select: ['id'] // Optimización: solo traer ID
            });
            return !!like;
        });
    }
}
exports.LikeService = LikeService;
