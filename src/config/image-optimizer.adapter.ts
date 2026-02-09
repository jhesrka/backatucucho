import sharp from 'sharp';

export enum ImageSize {
    THUMBNAIL = 'thumb',
    CARD = 'card',
    LARGE = 'large',
    RECEIPT = 'receipt',
    ORIGINAL = 'original'
}

interface ResizeOptions {
    width?: number;
    height?: number;
    quality?: number;
}

const SIZE_CONFIG: Record<ImageSize, ResizeOptions> = {
    [ImageSize.THUMBNAIL]: { width: 200, height: 200, quality: 80 },
    [ImageSize.CARD]: { width: 600, quality: 80 },
    [ImageSize.LARGE]: { width: 1080, height: 1080, quality: 85 }, // Square crop as per UI (1080x1080)
    [ImageSize.RECEIPT]: { width: 1280, quality: 85 }, // Maintain aspect ratio, max width 1280
    [ImageSize.ORIGINAL]: { quality: 90 }
};

export class ImageOptimizer {

    static async optimize(buffer: Buffer, size: ImageSize = ImageSize.ORIGINAL): Promise<Buffer> {
        const config = SIZE_CONFIG[size];

        let pipeline = sharp(buffer);

        if (config.width && config.height) {
            // Para thumbnails y Large (Productos), forzamos cuadrado centrado (Relación 1:1)
            pipeline = pipeline.resize(config.width, config.height, {
                fit: 'cover',
                position: 'center'
            });
        } else if (config.width || config.height) {
            // Redimensionar manteniendo proporción (solo si es más grande que el destino)
            pipeline = pipeline.resize({
                width: config.width,
                height: config.height,
                withoutEnlargement: true,
                fit: 'inside'
            });
        }

        // Siempre convertir a WebP para mejor compresión
        return await pipeline
            .webp({ quality: config.quality })
            .toBuffer();
    }

    static async getMetadata(buffer: Buffer) {
        return await sharp(buffer).metadata();
    }
}
