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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ImageOptimizer = exports.ImageSize = void 0;
const sharp_1 = __importDefault(require("sharp"));
var ImageSize;
(function (ImageSize) {
    ImageSize["THUMBNAIL"] = "thumb";
    ImageSize["CARD"] = "card";
    ImageSize["LARGE"] = "large";
    ImageSize["RECEIPT"] = "receipt";
    ImageSize["ORIGINAL"] = "original";
})(ImageSize || (exports.ImageSize = ImageSize = {}));
const SIZE_CONFIG = {
    [ImageSize.THUMBNAIL]: { width: 200, height: 200, quality: 80 },
    [ImageSize.CARD]: { width: 600, quality: 80 },
    [ImageSize.LARGE]: { width: 1080, height: 1080, quality: 85 }, // Square crop as per UI (1080x1080)
    [ImageSize.RECEIPT]: { width: 1280, quality: 85 }, // Maintain aspect ratio, max width 1280
    [ImageSize.ORIGINAL]: { quality: 90 }
};
class ImageOptimizer {
    static optimize(buffer_1) {
        return __awaiter(this, arguments, void 0, function* (buffer, size = ImageSize.ORIGINAL) {
            const config = SIZE_CONFIG[size];
            let pipeline = (0, sharp_1.default)(buffer);
            if (config.width && config.height) {
                // Para thumbnails y Large (Productos), forzamos cuadrado centrado (Relación 1:1)
                pipeline = pipeline.resize(config.width, config.height, {
                    fit: 'cover',
                    position: 'center'
                });
            }
            else if (config.width || config.height) {
                // Redimensionar manteniendo proporción (solo si es más grande que el destino)
                pipeline = pipeline.resize({
                    width: config.width,
                    height: config.height,
                    withoutEnlargement: true,
                    fit: 'inside'
                });
            }
            // Siempre convertir a WebP para mejor compresión
            return yield pipeline
                .webp({ quality: config.quality })
                .toBuffer();
        });
    }
    static getMetadata(buffer) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield (0, sharp_1.default)(buffer).metadata();
        });
    }
}
exports.ImageOptimizer = ImageOptimizer;
