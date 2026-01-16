export class GlobalSettingsDTO {
    private constructor(public orderRetentionDays: number) { }

    static create(object: {
        [key: string]: any;
    }): [string?, GlobalSettingsDTO?] {
        const { orderRetentionDays } = object;

        if (
            orderRetentionDays === undefined ||
            orderRetentionDays === null ||
            isNaN(Number(orderRetentionDays))
        ) {
            return ["orderRetentionDays must be a valid number"];
        }

        return [undefined, new GlobalSettingsDTO(Number(orderRetentionDays))];
    }
}
