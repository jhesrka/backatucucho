
import { UploadFilesCloud } from "./src/config/upload-files-cloud-adapter";
import { envs } from "./src/config";
import fs from "fs";

async function testS3() {
    const dummyBuffer = Buffer.from("hello world");
    try {
        console.log("Testing S3 upload...");
        const key = await UploadFilesCloud.uploadSingleFile({
            bucketName: envs.AWS_BUCKET_NAME,
            key: `test/test-${Date.now()}.txt`,
            body: dummyBuffer,
            contentType: "text/plain"
        });
        console.log("Success! Key:", key);
    } catch (error) {
        console.error("S3 upload failed:", error);
    }
}

testS3();
