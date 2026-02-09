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
exports.LikeController = void 0;
const domain_1 = require("../../domain");
const like_dto_1 = require("../../domain/dtos/likes/like.dto");
class LikeController {
    constructor(likeService) {
        this.likeService = likeService;
        this.handleError = (error, res) => {
            if (error instanceof domain_1.CustomError) {
                return res.status(error.statusCode).json({ message: error.message });
            }
            console.error("Unhandled error:", error);
            return res.status(500).json({ message: "Error inesperado" });
        };
        /**
         * Agrega un like a un post.
         */
        this.addLike = (req, res) => __awaiter(this, void 0, void 0, function* () {
            var _a;
            // Si el body no trae userId pero tenemos sessionUser (AuthMiddleware), lo inyectamos
            if (!req.body.userId && ((_a = req.body.sessionUser) === null || _a === void 0 ? void 0 : _a.id)) {
                req.body.userId = req.body.sessionUser.id;
            }
            const [error, createLikeDto] = like_dto_1.CreateLikeDTO.create(req.body);
            if (error)
                return res.status(400).json({ message: error });
            this.likeService
                .addLike(createLikeDto)
                .then((result) => res.status(200).json(result))
                .catch((err) => this.handleError(err, res));
        });
        /**
         * Elimina un like de un post.
         */
        this.removeLike = (req, res) => __awaiter(this, void 0, void 0, function* () {
            var _a;
            const { postId } = req.params;
            const userId = (_a = req.body.sessionUser) === null || _a === void 0 ? void 0 : _a.id; // Autenticación middleware debe proveer esto
            if (!userId)
                return res.status(401).json({ message: "Usuario no autenticado" });
            this.likeService
                .removeLike(postId, userId)
                .then((result) => res.status(200).json(result))
                .catch((err) => this.handleError(err, res));
        });
        /**
         * Cuenta la cantidad total de likes de un post.
         */
        this.countLikesByPost = (req, res) => __awaiter(this, void 0, void 0, function* () {
            const { postId } = req.params;
            this.likeService
                .countLikesByPost(postId)
                .then((count) => res.status(200).json({ count }))
                .catch((err) => this.handleError(err, res));
        });
        /**
         * Verifica si un usuario ya dio like a un post.
         */
        this.hasUserLikedPost = (req, res) => __awaiter(this, void 0, void 0, function* () {
            const { postId, userId } = req.params;
            this.likeService
                .hasUserLikedPost(userId, postId)
                .then((liked) => res.status(200).json({ liked }))
                .catch((err) => this.handleError(err, res));
        });
    }
}
exports.LikeController = LikeController;
