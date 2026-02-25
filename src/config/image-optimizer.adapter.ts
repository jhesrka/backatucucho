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
    [ImageSize.THUMBNAIL]: { width: 300, height: 300, quality: 80 }, // Max 300x300, preserve aspect ratio
    [ImageSize.CARD]: { width: 600, quality: 80 },
    [ImageSize.LARGE]: { width: 1920, height: 1920, quality: 85 }, // Max 1920x1920, preserve aspect ratio
    [ImageSize.RECEIPT]: { width: 1280, quality: 85 },
    [ImageSize.ORIGINAL]: { quality: 90 }
};

export class ImageOptimizer {

    static async optimize(buffer: Buffer, size: ImageSize = ImageSize.ORIGINAL): Promise<Buffer> {
        const config = SIZE_CONFIG[size];

        let pipeline = sharp(buffer);

        if (config.width || config.height) {
            // Updated logic: ALWAYS preserve aspect ratio (fit: 'inside')
            // This prevents 1:1 forced cropping.
            pipeline = pipeline.resize({
                width: config.width,
                height: config.height, // If both provided, it fits INSIDE the box
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
