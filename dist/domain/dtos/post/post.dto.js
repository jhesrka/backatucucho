"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateDTO = void 0;
const config_1 = require("../../../config");
class CreateDTO {
    constructor(title, subtitle, content, imgpost, userId) {
        this.title = title;
        this.subtitle = subtitle;
        this.content = content;
        this.imgpost = imgpost;
        this.userId = userId;
    }
    static create(object) {
        const { title, subtitle, content, imgpost, userId } = object;
        if (!title) {
            return ["El titulo es necesario"];
        }
        if (!subtitle) {
            return ["El subtítulo es necesario"];
        }
        if (!content) {
            return ["El contenido es necesario"];
        }
        if (!userId || typeof userId !== "string" || !config_1.regularExp.uuid.test(userId)) {
            return ["Formato invalido de uuid"];
        }
        return [
            undefined,
            new CreateDTO(title, subtitle, content, imgpost, userId),
        ];
    }
}
exports.CreateDTO = CreateDTO;
