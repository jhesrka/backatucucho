import { Request, Response } from "express";
import { UploadFilesCloud } from "../../config/upload-files-cloud-adapter";
import { envs } from "../../config/env";
import { v4 as uuidv4 } from "uuid";

export class UploadController {
    constructor() { }

    uploadFile = async (req: Request, res: Response) => {
        try {
            if (!req.file) {
                return res.status(400).json({ message: "No file uploaded" });
            }

            const fileExtension = req.file.originalname.split(".").pop() || "bin";
            const fileName = `${uuidv4()}.${fileExtension}`;
            const folder = "uploads/backups";
            const key = `${folder}/${fileName}`;

            const uploadedKey = await UploadFilesCloud.uploadSingleFile({
                bucketName: envs.AWS_BUCKET_NAME,
                key: key,
                body: req.file.buffer,
                contentType: req.file.mimetype,
            });

            // Get signed URL for the response
            const signedUrl = await UploadFilesCloud.getFile({
                bucketName: envs.AWS_BUCKET_NAME,
                key: uploadedKey
            });

            return res.status(200).json({
                success: true,
                url: signedUrl,
                key: uploadedKey,
                secure_url: signedUrl // For compatibility with frontend expectation
            });

        } catch (error) {
            console.error("Upload error:", error);
            return res.status(500).json({ message: "Error uploading file" });
        }
    };
}
