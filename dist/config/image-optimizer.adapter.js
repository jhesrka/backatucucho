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
    [ImageSize.THUMBNAIL]: { width: 300, height: 300, quality: 80 }, // Max 300x300, preserve aspect ratio
    [ImageSize.CARD]: { width: 600, quality: 80 },
    [ImageSize.LARGE]: { width: 1920, height: 1920, quality: 85 }, // Max 1920x1920, preserve aspect ratio
    [ImageSize.RECEIPT]: { width: 1280, quality: 85 },
    [ImageSize.ORIGINAL]: { quality: 90 }
};
class ImageOptimizer {
    static optimize(buffer_1) {
        return __awaiter(this, arguments, void 0, function* (buffer, size = ImageSize.ORIGINAL) {
            const config = SIZE_CONFIG[size];
            let pipeline = (0, sharp_1.default)(buffer);
            if (config.width || config.height) {
                // Updated logic: ALWAYS preserve aspect ratio (fit: 'inside')
                // This prevents 1:1 forced cropping.
                pipeline = pipeline.resize({
                    width: config.width,
                    height: config.height, // If both provided, it fits INSIDE the box
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
