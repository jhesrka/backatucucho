import multer from "multer";

const storage = multer.memoryStorage();
const upload = multer({ storage });

export const uploadSingleFile = (fileName: string) => upload.single(fileName);
export const uploadMultipleFile = (fileName: string, maxFileNumber: number) =>
  upload.array(fileName, maxFileNumber);
