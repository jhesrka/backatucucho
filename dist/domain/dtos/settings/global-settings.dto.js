"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GlobalSettingsDTO = void 0;
class GlobalSettingsDTO {
    constructor(orderRetentionDays) {
        this.orderRetentionDays = orderRetentionDays;
    }
    static create(object) {
        const { orderRetentionDays } = object;
        if (orderRetentionDays === undefined ||
            orderRetentionDays === null ||
            isNaN(Number(orderRetentionDays))) {
            return ["orderRetentionDays must be a valid number"];
        }
        return [undefined, new GlobalSettingsDTO(Number(orderRetentionDays))];
    }
}
exports.GlobalSettingsDTO = GlobalSettingsDTO;
