import { Request, Response } from "express";
import { GlobalSettingsService } from "../../services/globalSettings/global-settings.service";

export class GlobalSettingsController {
    constructor(private readonly service: GlobalSettingsService) { }

    getSettings = (req: Request, res: Response) => {
        this.service.getSettings()
            .then(data => res.json(data))
            .catch(error => res.status(500).json({ error: "Internal Server Error" }));
    };

    updateSettings = (req: Request, res: Response) => {
        this.service.updateSettings(req.body)
            .then(data => res.json(data))
            .catch(error => res.status(500).json({ error: "Internal Server Error" }));
    };
}
