import { GlobalSettings } from "../../../data";
import { CustomError } from "../../../domain";

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
            await settings.save();
        }
        return settings;
    }

    async updateSettings(data: any) { // Type with DTO later
        let settings = await this.getSettings();
        if (data.supportWhatsapp !== undefined) settings.supportWhatsapp = data.supportWhatsapp;
        // Explicitly update text fields even if empty string (to allow clearing)
        if (data.termsAndConditions !== undefined) settings.termsAndConditions = data.termsAndConditions;
        if (data.privacyPolicy !== undefined) settings.privacyPolicy = data.privacyPolicy;

        // Maintain existing logic if any
        if (data.orderRetentionDays !== undefined) settings.orderRetentionDays = data.orderRetentionDays;
        if (data.freePostsLimit !== undefined) settings.freePostsLimit = data.freePostsLimit;

        if (data.subscriptionBasicPrice !== undefined) settings.subscriptionBasicPrice = data.subscriptionBasicPrice;
        if (data.subscriptionBasicPromoPrice !== undefined) settings.subscriptionBasicPromoPrice = data.subscriptionBasicPromoPrice;
        if (data.subscriptionBasicDurationDays !== undefined) settings.subscriptionBasicDurationDays = data.subscriptionBasicDurationDays;

        await settings.save();
        return settings;
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
}
