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
exports.getS3PublicUrl = void 0;
const config_1 = require("../config");
const upload_files_cloud_adapter_1 = require("../config/upload-files-cloud-adapter");
const getS3PublicUrl = (key) => __awaiter(void 0, void 0, void 0, function* () {
    if (!key)
        return undefined;
    const url = yield upload_files_cloud_adapter_1.UploadFilesCloud.getFile({
        bucketName: config_1.envs.AWS_BUCKET_NAME,
        key,
    });
    return url;
});
exports.getS3PublicUrl = getS3PublicUrl;
