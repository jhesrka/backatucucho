import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { s3 } from "./awsConfig";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { ImageOptimizer, ImageSize } from "./image-optimizer.adapter";

interface PropsUploadFile {
  bucketName: string;
  key: string;
  body: Buffer;
  contentType: string;
  isReceipt?: boolean;
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
    const { bucketName, key, body, contentType, isReceipt } = props;

    // Si no es imagen, subir normalmente (Case insensitive check)
    if (!contentType.toLowerCase().startsWith('image/')) {
      const command = new PutObjectCommand({
        Bucket: bucketName,
        Key: key,
        Body: body,
        ContentType: contentType,
      });
      await s3.send(command);
      return key;
    }

    // Si es imagen, optimizar y generar versiones
    try {
      // El key base siempre será .webp (Manejo robusto de extensiones)
      const extensionRegex = /\.[^/.]+$/;
      const baseKey = extensionRegex.test(key)
        ? key.replace(extensionRegex, ".webp")
        : key + ".webp";

      const thumbKey = baseKey.replace(".webp", "_thumb.webp");
      const cardKey = baseKey.replace(".webp", "_card.webp");

      // Generar versiones en PARALELO para máximo rendimiento
      const [thumb, card, large] = await Promise.all([
        ImageOptimizer.optimize(body, ImageSize.THUMBNAIL),
        ImageOptimizer.optimize(body, ImageSize.CARD),
        ImageOptimizer.optimize(body, isReceipt ? ImageSize.RECEIPT : ImageSize.LARGE)
      ]);

      // Subir todas las versiones en paralelo (E/S es menos pesada que CPU)
      await Promise.all([
        this.directUpload({ bucketName, key: thumbKey, body: thumb, contentType: 'image/webp' }),
        this.directUpload({ bucketName, key: cardKey, body: card, contentType: 'image/webp' }),
        this.directUpload({ bucketName, key: baseKey, body: large, contentType: 'image/webp' }),
      ]);

      return baseKey;
    } catch (error) {
      console.error("❌ Error optimizando imagen:", error instanceof Error ? error.message : error);
      // Fallback a subida original si algo falla en la optimización
      const command = new PutObjectCommand({
        Bucket: bucketName,
        Key: key,
        Body: body,
        ContentType: contentType,
      });
      await s3.send(command);
      return key;
    }
  }

  // Método auxiliar para evitar recursión y optimización doble
  private static async directUpload(props: PropsUploadFile): Promise<string> {
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


  static async getFile(props: PropsGetFile, size: ImageSize = ImageSize.ORIGINAL): Promise<string> {
    let { bucketName, key } = props;
    if (!key) return null as any; // 🛡️ Seguridad: Si no hay llave, no hay URL

    // Si ya es una URL completa (ej: Google Profile Picture), retornar tal cual
    if (key.startsWith('http')) return key;

    // OPTIMIZACIÓN DE RENDIMIENTO: Eliminamos 'checkFileExists' (HeadObject a S3)
    // para evitar el problema de N+1 peticiones de red por cada lista.
    // Simplemente generamos la URL firmada para la versión optimizada.
    // Si la versión no existe, el navegador mostrará fallback o el manejador de error local.
    if (size !== ImageSize.ORIGINAL && key.endsWith('.webp')) {
      const suffix = `_${size}`; // _thumb o _card
      key = key.replace(".webp", `${suffix}.webp`);
    }

    const params = {
      Bucket: bucketName,
      Key: key,
    };
    const command = new GetObjectCommand(params);
    const url = await getSignedUrl(s3, command, {
      expiresIn: 3600 * 24, // 24 horas por defecto para mejor cache
    });
    return url;
  }

  /**
   * Retorna URLs firmadas para todos los tamaños de una imagen base.
   */
   static async getOptimizedUrls(props: PropsGetFile) {
    if (!props.key) return { original: null, card: null, thumb: null };

    const [original, card, thumb] = await Promise.all([
      this.getFile(props, ImageSize.ORIGINAL),
      this.getFile(props, ImageSize.CARD),
      this.getFile(props, ImageSize.THUMBNAIL),
    ]);

    return { original, card, thumb };
  }

  static async deleteFile(props: PropsGetFile): Promise<void> {
    if (!props.key) return; // 🛡️ Seguridad: Si no hay llave, no hay nada que borrar

    // Si es un webp, intentamos borrar también los derivados
    if (props.key.endsWith('.webp')) {
      const thumbKey = props.key.replace(".webp", "_thumb.webp");
      const cardKey = props.key.replace(".webp", "_card.webp");

      await Promise.all([
        this.deleteSingleFile({ ...props, key: thumbKey }),
        this.deleteSingleFile({ ...props, key: cardKey }),
        this.deleteSingleFile(props),
      ]);
      return;
    }

    await this.deleteSingleFile(props);
  }

  private static async deleteSingleFile(props: PropsGetFile): Promise<void> {
    const params = {
      Bucket: props.bucketName,
      Key: props.key,
    };
    const command = new DeleteObjectCommand(params);
    await s3.send(command).catch(() => null); // Ignorar errores si no existe
  }
}

