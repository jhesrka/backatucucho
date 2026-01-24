import { Router } from "express";
import { UploadController } from "./upload.controller";
import { uploadSingleFile } from "../../config";
import { AuthAdminMiddleware } from "../../middlewares";

export class UploadRoutes {
    static get routes(): Router {
        const router = Router();
        const controller = new UploadController();

        // POST /api/upload/file
        router.post(
            "/file",
            // [AuthAdminMiddleware.protect], // Uncomment if you want strict admin protection for this route
            uploadSingleFile("file"),
            controller.uploadFile
        );

        return router;
    }
}
