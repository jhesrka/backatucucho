import { envs } from "../config";
import { UploadFilesCloud } from "../config/upload-files-cloud-adapter";

export const getS3PublicUrl = async (key?: string): Promise<string | undefined> => {
  if (!key) return undefined;

  const url = await UploadFilesCloud.getFile({
    bucketName: envs.AWS_BUCKET_NAME,
    key,
  });

  return url;
};
