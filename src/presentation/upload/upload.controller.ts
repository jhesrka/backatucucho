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

            // Construct public URL directly
            const url = `https://${envs.AWS_BUCKET_NAME}.s3.${envs.AWS_REGION}.amazonaws.com/${uploadedKey}`;

            return res.status(200).json({
                success: true,
                url: url,
                key: uploadedKey,
                secure_url: url // For compatibility with frontend expectation
            });

        } catch (error) {
            console.error("Upload error:", error);
            return res.status(500).json({ message: "Error uploading file" });
        }
    };
}
