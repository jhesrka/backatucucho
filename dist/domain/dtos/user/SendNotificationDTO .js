"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SendNotificationDTO = void 0;
class SendNotificationDTO {
    constructor(id, subject, message, sendEmail = true // ✅ puedes dejarlo o eliminarlo si siempre será true
    ) {
        this.id = id;
        this.subject = subject;
        this.message = message;
        this.sendEmail = sendEmail;
    }
    static create(data) {
        const errors = [];
        if (!data.id || typeof data.id !== "string" || data.id.trim().length === 0) {
            errors.push("El ID del usuario es obligatorio.");
        }
        if (!data.subject || typeof data.subject !== "string" || data.subject.trim().length < 3) {
            errors.push("El asunto es obligatorio y debe tener al menos 3 caracteres.");
        }
        if (!data.message || typeof data.message !== "string" || data.message.trim().length < 5) {
            errors.push("El mensaje es obligatorio y debe tener al menos 5 caracteres.");
        }
        const sendEmail = data.sendEmail === undefined ? true : Boolean(data.sendEmail);
        if (errors.length > 0)
            return [errors];
        return [
            undefined,
            new SendNotificationDTO(data.id.trim(), data.subject.trim(), data.message.trim(), sendEmail),
        ];
    }
}
exports.SendNotificationDTO = SendNotificationDTO;
