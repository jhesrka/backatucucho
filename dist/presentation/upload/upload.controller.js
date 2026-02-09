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
exports.UploadController = void 0;
const upload_files_cloud_adapter_1 = require("../../config/upload-files-cloud-adapter");
const env_1 = require("../../config/env");
const uuid_1 = require("uuid");
class UploadController {
    constructor() {
        this.uploadFile = (req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                if (!req.file) {
                    return res.status(400).json({ message: "No file uploaded" });
                }
                const fileExtension = req.file.originalname.split(".").pop() || "bin";
                const fileName = `${(0, uuid_1.v4)()}.${fileExtension}`;
                const folder = "uploads/backups";
                const key = `${folder}/${fileName}`;
                const uploadedKey = yield upload_files_cloud_adapter_1.UploadFilesCloud.uploadSingleFile({
                    bucketName: env_1.envs.AWS_BUCKET_NAME,
                    key: key,
                    body: req.file.buffer,
                    contentType: req.file.mimetype,
                });
                // Construct public URL directly
                const url = `https://${env_1.envs.AWS_BUCKET_NAME}.s3.${env_1.envs.AWS_REGION}.amazonaws.com/${uploadedKey}`;
                return res.status(200).json({
                    success: true,
                    url: url,
                    key: uploadedKey,
                    secure_url: url // For compatibility with frontend expectation
                });
            }
            catch (error) {
                console.error("Upload error:", error);
                return res.status(500).json({ message: "Error uploading file" });
            }
        });
    }
}
exports.UploadController = UploadController;
