import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { s3 } from "./awsConfig";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

interface PropsUploadFile {
  bucketName: string;
  key: string;
  body: Buffer;
  contentType: string;
}

interface PropsGetFile {
  bucketName: string;
  key: string;
}

export class UploadFilesCloud {
  static async checkFileExists(props: PropsGetFile): Promise<boolean> {
    try {
      const params = {
        Bucket: props.bucketName,
        Key: props.key,
      };
      const command = new HeadObjectCommand(params);
      await s3.send(command);
      return true;
    } catch (error) {
      return false;
    }
  }

  static async uploadSingleFile(props: PropsUploadFile): Promise<string> {
    const { bucketName, key, body, contentType } = props;

    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: body,
      ContentType: contentType,
    });
    await s3.send(command);
    return key;
  }
  static async getFile(props: PropsGetFile): Promise<string> {
    const params = {
      Bucket: props.bucketName,
      Key: props.key,
      // ACL: "private", // ACL not needed for GetObject
    };
    const command = new GetObjectCommand(params);
    const url = await getSignedUrl(s3, command, {
      expiresIn: 50000,
    });
    return url;
  }
  static async deleteFile(props: PropsGetFile): Promise<void> {
    const params = {
      Bucket: props.bucketName,
      Key: props.key,
    };
    const command = new DeleteObjectCommand(params);
    await s3.send(command);
  }

}
