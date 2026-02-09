"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CustomError = void 0;
class CustomError extends Error {
    constructor(statusCode, message) {
        super(message);
        this.statusCode = statusCode;
        this.name = "CustomError";
        Object.setPrototypeOf(this, CustomError.prototype); // Necesario para instanceof
    }
    static badRequest(message) {
        return new CustomError(400, message);
    }
    static unAuthorized(message) {
        return new CustomError(401, message);
    }
    static forbiden(message) {
        return new CustomError(403, message);
    }
    static notFound(message) {
        return new CustomError(404, message);
    }
    static conflict(message) {
        // ⚠️ NUEVO MÉTODO PARA CONFLICTOS DE DUPLICADO
        return new CustomError(409, message);
    }
    static internalServer(message) {
        return new CustomError(500, message);
    }
    static serviceUnavailable(message) {
        return new CustomError(503, message);
    }
}
exports.CustomError = CustomError;
