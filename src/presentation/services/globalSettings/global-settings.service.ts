import { GlobalSettings } from "../../../data";
import { CustomError } from "../../../domain";
import { UploadFilesCloud } from "../../../config/upload-files-cloud-adapter";
import { ImageOptimizer, ImageSize } from "../../../config/image-optimizer.adapter";
import { envs } from "../../../config";
import bcrypt from "bcryptjs";

export class GlobalSettingsService {
    async getSettings() {
        let settings = await GlobalSettings.findOne({ where: {} });
        if (!settings) {
            settings = new GlobalSettings();
            // Defaults?
            settings.orderRetentionDays = 20;
            settings.freePostsLimit = 5;
            settings.freePostDurationDays = 1;
            settings.freePostDurationHours = 0;
            settings.subscriptionBasicPrice = 5.00;
            settings.subscriptionBasicDurationDays = 30;
            settings.reportsRetentionDays = 30;
            settings.currentTermsVersion = "v1.0";
            settings.hora_apertura = "08:00:00";
            settings.hora_cierre = "22:00:00";
            settings.app_status = "CLOSED";
            settings.modo_operacion = "AUTO";
            settings.max_wait_time_acceptance = 10;
            settings.cleanupSubscriptionContentDays = 60;
            settings.payphoneRechargePercentage = 0.00;
            await settings.save();
        }

        if (settings.businessCover?.imageUrl) {
            try {
                settings.businessCover.imageUrl = await UploadFilesCloud.getFile({
                    bucketName: envs.AWS_BUCKET_NAME,
                    key: settings.businessCover.imageUrl,
                });
            } catch (e) { console.error(e); }
        }

        return settings;
    }

    async updateSettings(data: any, file?: Express.Multer.File) { // Type with DTO later
        if (data.masterPin) {
            const currentSettings = await this.getSettings();
            if (currentSettings.masterPin) {
                const isMatch = await bcrypt.compare(data.masterPin, currentSettings.masterPin);
                if (!isMatch) throw CustomError.badRequest("PIN Maestro incorrecto");
            }
        }

        let settings = await GlobalSettings.findOne({ where: {} });
        if (!settings) settings = new GlobalSettings();

        let termsChanged = false;

        if (data.supportWhatsapp) settings.supportWhatsapp = data.supportWhatsapp;

        // Explicitly update text fields if provided
        if (data.termsAndConditions) {
            if (settings.termsAndConditions !== data.termsAndConditions) {
                settings.termsAndConditions = data.termsAndConditions;
                termsChanged = true;
            }
        }
        if (data.privacyPolicy) {
            if (settings.privacyPolicy !== data.privacyPolicy) {
                settings.privacyPolicy = data.privacyPolicy;
                termsChanged = true;
            }
        }

        if (termsChanged) {
            // Incrementar versión (ej: v1.0 -> v1.1 o generar timestamp-based)
            const matches = settings.currentTermsVersion.match(/v(\d+)\.(\d+)/);
            if (matches) {
                const major = parseInt(matches[1]);
                const minor = parseInt(matches[2]) + 1;
                settings.currentTermsVersion = `v${major}.${minor}`;
            } else {
                settings.currentTermsVersion = `v1.1`;
            }
            settings.termsUpdatedAt = new Date();
        }

        // Maintain existing logic if any
        if (data.orderRetentionDays !== undefined) settings.orderRetentionDays = data.orderRetentionDays;
        if (data.reportsRetentionDays !== undefined) settings.reportsRetentionDays = data.reportsRetentionDays;
        if (data.freePostsLimit !== undefined) settings.freePostsLimit = data.freePostsLimit;

        // NEW: Schedule Settings (FALSY SKIP TO AVOID DB ERROR WITH EMPTY STRINGS)
        if (data.hora_apertura) settings.hora_apertura = data.hora_apertura;
        if (data.hora_cierre) settings.hora_cierre = data.hora_cierre;

        if (data.subscriptionBasicPrice !== undefined) settings.subscriptionBasicPrice = data.subscriptionBasicPrice;
        if (data.subscriptionBasicPromoPrice !== undefined) settings.subscriptionBasicPromoPrice = data.subscriptionBasicPromoPrice;
        if (data.subscriptionBasicDurationDays !== undefined) settings.subscriptionBasicDurationDays = data.subscriptionBasicDurationDays;

        if (data.timeoutRondaMs !== undefined) settings.timeoutRondaMs = data.timeoutRondaMs;
        if (data.maxRondasAsignacion !== undefined) settings.maxRondasAsignacion = data.maxRondasAsignacion;
        if (data.max_wait_time_acceptance !== undefined) settings.max_wait_time_acceptance = Number(data.max_wait_time_acceptance);
        if (data.cleanupSubscriptionContentDays !== undefined) settings.cleanupSubscriptionContentDays = Number(data.cleanupSubscriptionContentDays);

        // Payphone
        if (data.payphoneToken !== undefined) settings.payphoneToken = data.payphoneToken;
        if (data.payphoneStoreId !== undefined) settings.payphoneStoreId = data.payphoneStoreId;
        if (data.payphoneRechargePercentage !== undefined) settings.payphoneRechargePercentage = Number(data.payphoneRechargePercentage);

        const coverRaw = data.businessCover || data.cover;
        if (coverRaw) {
            try {
                settings.businessCover = typeof coverRaw === 'string' 
                    ? JSON.parse(coverRaw) 
                    : coverRaw;
            } catch (e) {
                console.error("Error parsing businessCover JSON", e);
            }
        }

        if (file) {
            try {
                // Delete old cover image if it exists
                if (settings.businessCover?.imageUrl) {
                    try {
                        await UploadFilesCloud.deleteFile({
                            bucketName: envs.AWS_BUCKET_NAME,
                            key: settings.businessCover.imageUrl
                        });
                    } catch (e) {
                        console.error("[GlobalSettingsService] Error deleting old cover:", e);
                    }
                }

                // ⚡️ OPTIMIZACIÓN DE IMAGEN
                const optimizedBuffer = await ImageOptimizer.optimize(file.buffer, ImageSize.LARGE);

                const key = await UploadFilesCloud.uploadSingleFile({
                    bucketName: envs.AWS_BUCKET_NAME,
                    key: `settings/covers/${Date.now()}-${file.originalname.replace(/\.[^/.]+$/, "")}.webp`,
                    body: optimizedBuffer,
                    contentType: 'image/webp',
                });

                if (!settings.businessCover) settings.businessCover = { type: 'image', imageUrl: key };
                else settings.businessCover = { ...settings.businessCover, imageUrl: key };
            } catch (error) {
                throw CustomError.internalServer("Error actualizando la imagen de portada de la sección negocios");
            }
        }

        await settings.save();
        return await this.getSettings();
    }

    async updateFreePostSettings(dto: {
        freePostsLimit?: number;
        freePostDurationDays?: number;
        freePostDurationHours?: number;
    }) {
        let settings = await this.getSettings();
        if (dto.freePostsLimit !== undefined) settings.freePostsLimit = dto.freePostsLimit;
        if (dto.freePostDurationDays !== undefined) settings.freePostDurationDays = dto.freePostDurationDays;
        if (dto.freePostDurationHours !== undefined) settings.freePostDurationHours = dto.freePostDurationHours;

        await settings.save();
        return settings;
    }
    async closeApp() {
        const settings = await this.getSettings();
        settings.app_status = "CLOSED";
        settings.modo_operacion = "MANUAL";
        await settings.save();
        return settings;
    }

    async enableAutoMode() {
        const settings = await this.getSettings();
        settings.modo_operacion = "AUTO";
        await settings.save();

        // 🔥 RECÁLCULO INMEDIATO
        await this.checkAppSchedule();

        return settings;
    }

    async checkAppSchedule() {
        const settings = await this.getSettings();

        if (settings.modo_operacion === 'MANUAL') {
            return; // Do nothing
        }

        // 1️⃣ 🔥 ZONA HORARIA OBLIGATORIA (America/Guayaquil)
        // Obtener hora actual en Ecuador
        const now = new Date();
        const ecuadorTimeStr = now.toLocaleString("en-US", { timeZone: "America/Guayaquil" });
        const ecuadorDate = new Date(ecuadorTimeStr);

        const currentH = ecuadorDate.getHours();
        const currentM = ecuadorDate.getMinutes();

        // Parse database times which are strings "HH:mm:ss"
        const [openH, openM] = settings.hora_apertura.split(':').map(Number);
        const [closeH, closeM] = settings.hora_cierre.split(':').map(Number);

        const currentMinutes = currentH * 60 + currentM;
        const openMinutes = openH * 60 + openM;
        const closeMinutes = closeH * 60 + closeM;

        let newState: "OPEN" | "CLOSED" = "CLOSED";

        if (currentMinutes >= openMinutes && currentMinutes < closeMinutes) {
            newState = "OPEN";
        } else {
            newState = "CLOSED";
        }

        if (newState !== settings.app_status) {
            console.log(`[CRON/AUTO] Updating App Status: ${settings.app_status} -> ${newState} (Ecuador Time: ${currentH}:${currentM})`);
            settings.app_status = newState;
            // 5️⃣ 🔥 MEJORA OPCIONAL: Audit field
            settings.ultimo_cambio_automatico = new Date(); // Save server time or ecuador time? TypeORM handles Date as timestamp. using server time is fine for audit.
            await settings.save();
        }
    }
}
