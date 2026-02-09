"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateLikeDTO = void 0;
class CreateLikeDTO {
    constructor(postId, userId) {
        this.postId = postId;
        this.userId = userId;
    }
    static create(object) {
        const { postId, userId } = object;
        if (!postId || typeof postId !== "string") {
            return ["El postId es requerido y debe ser un string"];
        }
        if (!userId || typeof userId !== "string") {
            return ["El userId es requerido y debe ser un string"];
        }
        return [undefined, new CreateLikeDTO(postId, userId)];
    }
}
exports.CreateLikeDTO = CreateLikeDTO;
