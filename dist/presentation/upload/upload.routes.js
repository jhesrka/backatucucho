"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UploadRoutes = void 0;
const express_1 = require("express");
const upload_controller_1 = require("./upload.controller");
const config_1 = require("../../config");
class UploadRoutes {
    static get routes() {
        const router = (0, express_1.Router)();
        const controller = new upload_controller_1.UploadController();
        // POST /api/upload/file
        router.post("/file", 
        // [AuthAdminMiddleware.protect], // Uncomment if you want strict admin protection for this route
        (0, config_1.uploadSingleFile)("file"), controller.uploadFile);
        return router;
    }
}
exports.UploadRoutes = UploadRoutes;
