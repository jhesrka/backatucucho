"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadMultipleFile = exports.uploadSingleFile = void 0;
const multer_1 = __importDefault(require("multer"));
const storage = multer_1.default.memoryStorage();
const upload = (0, multer_1.default)({ storage });
const uploadSingleFile = (fileName) => upload.single(fileName);
exports.uploadSingleFile = uploadSingleFile;
const uploadMultipleFile = (fileName, maxFileNumber) => upload.array(fileName, maxFileNumber);
exports.uploadMultipleFile = uploadMultipleFile;
