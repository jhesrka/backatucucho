"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateStorieDTO = void 0;
// src/domain/dtos/storie/CreateStorie.dto.ts
const config_1 = require("../../../config");
class CreateStorieDTO {
    constructor(description, imgstorie, userId, dias, showWhatsapp) {
        this.description = description;
        this.imgstorie = imgstorie;
        this.userId = userId;
        this.dias = dias;
        this.showWhatsapp = showWhatsapp;
    }
    static create(object) {
        const { description, userId, dias, showWhatsapp } = object;
        if (!userId ||
            typeof userId !== "string" ||
            !config_1.regularExp.uuid.test(userId)) {
            return ["Formato inválido de UUID"];
        }
        if (!description || typeof description !== "string") {
            return ["La descripción es necesaria"];
        }
        const diasNumber = Number(dias);
        if (isNaN(diasNumber) || diasNumber < 1) {
            return ["Debes ingresar al menos 1 día"];
        }
        // Parse 'true'/'false' string or boolean
        let showWhatsappBool = true;
        if (showWhatsapp !== undefined && showWhatsapp !== null) {
            showWhatsappBool = String(showWhatsapp) === 'true';
        }
        return [
            undefined,
            new CreateStorieDTO(description, "", userId, diasNumber, showWhatsappBool),
        ];
    }
}
exports.CreateStorieDTO = CreateStorieDTO;
