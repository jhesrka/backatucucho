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
exports.UploadFilesCloud = void 0;
const client_s3_1 = require("@aws-sdk/client-s3");
const awsConfig_1 = require("./awsConfig");
const s3_request_presigner_1 = require("@aws-sdk/s3-request-presigner");
const image_optimizer_adapter_1 = require("./image-optimizer.adapter");
class UploadFilesCloud {
    static checkFileExists(props) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const params = {
                    Bucket: props.bucketName,
                    Key: props.key,
                };
                const command = new client_s3_1.HeadObjectCommand(params);
                yield awsConfig_1.s3.send(command);
                return true;
            }
            catch (error) {
                return false;
            }
        });
    }
    static uploadSingleFile(props) {
        return __awaiter(this, void 0, void 0, function* () {
            const { bucketName, key, body, contentType, isReceipt } = props;
            // Si no es imagen, subir normalmente (Case insensitive check)
            if (!contentType.toLowerCase().startsWith('image/')) {
                const command = new client_s3_1.PutObjectCommand({
                    Bucket: bucketName,
                    Key: key,
                    Body: body,
                    ContentType: contentType,
                });
                yield awsConfig_1.s3.send(command);
                return key;
            }
            // Si es imagen, optimizar y generar versiones
            try {
                // El key base siempre será .webp (Manejo robusto de extensiones)
                const extensionRegex = /\.[^/.]+$/;
                const baseKey = extensionRegex.test(key)
                    ? key.replace(extensionRegex, ".webp")
                    : key + ".webp";
                const thumbKey = baseKey.replace(".webp", "_thumb.webp");
                const cardKey = baseKey.replace(".webp", "_card.webp");
                // Generar versiones SECUENCIALMENTE para ahorrar memoria en el servidor local
                const thumb = yield image_optimizer_adapter_1.ImageOptimizer.optimize(body, image_optimizer_adapter_1.ImageSize.THUMBNAIL);
                const card = yield image_optimizer_adapter_1.ImageOptimizer.optimize(body, image_optimizer_adapter_1.ImageSize.CARD);
                // Use RECEIPT size (no crop) if isReceipt is true, otherwise default to LARGE (crop)
                const baseSize = isReceipt ? image_optimizer_adapter_1.ImageSize.RECEIPT : image_optimizer_adapter_1.ImageSize.LARGE;
                const large = yield image_optimizer_adapter_1.ImageOptimizer.optimize(body, baseSize);
                // Subir todas las versiones en paralelo (E/S es menos pesada que CPU)
                yield Promise.all([
                    this.directUpload({ bucketName, key: thumbKey, body: thumb, contentType: 'image/webp' }),
                    this.directUpload({ bucketName, key: cardKey, body: card, contentType: 'image/webp' }),
                    this.directUpload({ bucketName, key: baseKey, body: large, contentType: 'image/webp' }),
                ]);
                return baseKey;
            }
            catch (error) {
                console.error("❌ Error optimizando imagen:", error instanceof Error ? error.message : error);
                // Fallback a subida original si algo falla en la optimización
                const command = new client_s3_1.PutObjectCommand({
                    Bucket: bucketName,
                    Key: key,
                    Body: body,
                    ContentType: contentType,
                });
                yield awsConfig_1.s3.send(command);
                return key;
            }
        });
    }
    // Método auxiliar para evitar recursión y optimización doble
    static directUpload(props) {
        return __awaiter(this, void 0, void 0, function* () {
            const { bucketName, key, body, contentType } = props;
            const command = new client_s3_1.PutObjectCommand({
                Bucket: bucketName,
                Key: key,
                Body: body,
                ContentType: contentType,
            });
            yield awsConfig_1.s3.send(command);
            return key;
        });
    }
    static getFile(props_1) {
        return __awaiter(this, arguments, void 0, function* (props, size = image_optimizer_adapter_1.ImageSize.ORIGINAL) {
            let { bucketName, key } = props;
            // Si ya es una URL completa (ej: Google Profile Picture), retornar tal cual
            if (key.startsWith('http'))
                return key;
            // Si se solicita un tamaño específico y el archivo es un .webp generado por nosotros
            if (size !== image_optimizer_adapter_1.ImageSize.ORIGINAL && key.endsWith('.webp')) {
                const suffix = `_${size}`; // _thumb o _card
                const sizedKey = key.replace(".webp", `${suffix}.webp`);
                // Intentamos ver si existe el sizedKey
                const exists = yield this.checkFileExists({ bucketName, key: sizedKey });
                if (exists) {
                    key = sizedKey;
                }
            }
            const params = {
                Bucket: bucketName,
                Key: key,
            };
            const command = new client_s3_1.GetObjectCommand(params);
            const url = yield (0, s3_request_presigner_1.getSignedUrl)(awsConfig_1.s3, command, {
                expiresIn: 3600 * 24, // 24 horas por defecto para mejor cache
            });
            return url;
        });
    }
    /**
     * Retorna URLs firmadas para todos los tamaños de una imagen base.
     */
    static getOptimizedUrls(props) {
        return __awaiter(this, void 0, void 0, function* () {
            const [original, card, thumb] = yield Promise.all([
                this.getFile(props, image_optimizer_adapter_1.ImageSize.ORIGINAL),
                this.getFile(props, image_optimizer_adapter_1.ImageSize.CARD),
                this.getFile(props, image_optimizer_adapter_1.ImageSize.THUMBNAIL),
            ]);
            return { original, card, thumb };
        });
    }
    static deleteFile(props) {
        return __awaiter(this, void 0, void 0, function* () {
            // Si es un webp, intentamos borrar también los derivados
            if (props.key.endsWith('.webp')) {
                const thumbKey = props.key.replace(".webp", "_thumb.webp");
                const cardKey = props.key.replace(".webp", "_card.webp");
                yield Promise.all([
                    this.deleteSingleFile(Object.assign(Object.assign({}, props), { key: thumbKey })),
                    this.deleteSingleFile(Object.assign(Object.assign({}, props), { key: cardKey })),
                    this.deleteSingleFile(props),
                ]);
                return;
            }
            yield this.deleteSingleFile(props);
        });
    }
    static deleteSingleFile(props) {
        return __awaiter(this, void 0, void 0, function* () {
            const params = {
                Bucket: props.bucketName,
                Key: props.key,
            };
            const command = new client_s3_1.DeleteObjectCommand(params);
            yield awsConfig_1.s3.send(command).catch(() => null); // Ignorar errores si no existe
        });
    }
}
exports.UploadFilesCloud = UploadFilesCloud;
