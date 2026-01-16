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
const socket_1 = require("../../config/socket");
const data_1 = require("../../data");
const domain_1 = require("../../domain");
class PostService {
    constructor(userService) {
        this.userService = userService;
    }
    findAllPost() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return yield data_1.Post.find({
                    where: {
                        status: true,
                    },
                    relations: ["user"], //este es el user con el que esta en models y se hizo la relacion
                    select: {
                        user: {
                            id: true,
                            name: true,
                            surname: true,
                            photoperfil: true,
                            whatsapp: true
                        }
                    },
                    order: {
                        createdAt: "DESC", // Ordenar por fecha de creación, más reciente primero
                    },
                });
            }
            catch (error) {
                throw domain_1.CustomError.internalServer("Error obteniendo datos");
            }
        });
    }
    findOnePost(id) {
        return __awaiter(this, void 0, void 0, function* () {
            const post = yield data_1.Post.findOne({ where: { id } });
            if (!post)
                throw domain_1.CustomError.notFound("Post no encontrado");
            return post;
        });
    }
    createPost(postData) {
        return __awaiter(this, void 0, void 0, function* () {
            const post = new data_1.Post();
            //necesito buscar el usuario
            const user = yield this.userService.findOneUser(postData.userId);
            post.title = postData.title.toLowerCase().trim();
            post.subtitle = postData.subtitle.toLowerCase().trim();
            post.content = postData.content.trim();
            post.imgpost = postData.imgpost;
            //aqui ponemos el user que hizo esa publicacion del post osea aqui esta anclado
            post.user = user;
            try {
                const nuevoPost = yield post.save();
                (0, socket_1.getIO)().emit("postChanged", nuevoPost); // 🔥 Emitimos evento
                return nuevoPost;
            }
            catch (_a) {
                throw domain_1.CustomError.internalServer("Error creando el Post");
            }
        });
    }
    updatePost(id, postData) {
        return __awaiter(this, void 0, void 0, function* () {
            const post = yield this.findOnePost(id);
            post.title = postData.title.toLowerCase().trim();
            post.subtitle = postData.subtitle.toLowerCase().trim();
            post.content = postData.content.trim();
            post.imgpost = postData.imgpost;
            try {
                const postActualizado = yield post.save();
                (0, socket_1.getIO)().emit("postChanged", postActualizado); // 🔥 Emitimos evento
                return postActualizado;
            }
            catch (_a) {
                throw domain_1.CustomError.internalServer("Error actualizando el Post");
            }
        });
    }
    deletePost(id) {
        return __awaiter(this, void 0, void 0, function* () {
            const post = yield this.findOnePost(id);
            post.status = false;
            try {
                yield post.remove();
                (0, socket_1.getIO)().emit("postChanged", post); // 🔥 Emitimos evento
            }
            catch (_a) {
                throw domain_1.CustomError.internalServer("Error eliminando el Post");
            }
        });
    }
}
exports.PostService = PostService;
