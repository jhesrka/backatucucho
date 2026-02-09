"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateDTO = void 0;
class UpdateDTO {
    constructor(title, subtitle, content, imgpost, showWhatsApp, showLikes) {
        this.title = title;
        this.subtitle = subtitle;
        this.content = content;
        this.imgpost = imgpost;
        this.showWhatsApp = showWhatsApp;
        this.showLikes = showLikes;
    }
    static create(object) {
        return [undefined, new UpdateDTO(object.title, object.subtitle, object.content, object.imgpost, object.showWhatsApp, object.showLikes)];
    }
}
exports.UpdateDTO = UpdateDTO;
