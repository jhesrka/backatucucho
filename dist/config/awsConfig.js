"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.s3 = void 0;
// src/config/awsConfig.ts
const client_s3_1 = require("@aws-sdk/client-s3");
const env_1 = require("./env");
exports.s3 = new client_s3_1.S3Client({
    region: env_1.envs.AWS_REGION,
    credentials: {
        accessKeyId: env_1.envs.AWS_ACCESS_KEY_ID,
        secretAccessKey: env_1.envs.AWS_SECRET_ACCESS_KEY,
    },
});
