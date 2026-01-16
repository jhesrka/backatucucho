"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateDTO = void 0;
class UpdateDTO {
    constructor(title, subtitle, content, imgpost) {
        this.title = title;
        this.subtitle = subtitle;
        this.content = content;
        this.imgpost = imgpost;
    }
    static create(object) {
        const { title, subtitle, content, imgpost } = object;
        if (!title) {
            return ["El titulo es necesario"];
        }
        if (!subtitle) {
            return ["El subtítulo es necesario"];
        }
        if (!content) {
            return ["El contenido es necesario"];
        }
        return [undefined, new UpdateDTO(title, subtitle, content, imgpost)];
    }
}
exports.UpdateDTO = UpdateDTO;
