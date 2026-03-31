import { Request, Response } from "express";
import { GlobalSettingsService } from "../../services/globalSettings/global-settings.service";

export class GlobalSettingsController {
    constructor(private readonly service: GlobalSettingsService) { }

    getSettings = (req: Request, res: Response) => {
        this.service.getSettings()
            .then(data => res.json(data))
            .catch(error => {
                console.error("Error in getSettings:", error);
                res.status(500).json({ error: "Internal Server Error" });
            });
    };

    updateSettings = (req: Request, res: Response) => {
        this.service.updateSettings(req.body)
            .then(data => res.json(data))
            .catch(error => {
                console.error("Error updating settings:", error);
                res.status(500).json({ error: "Internal Server Error" });
            });
    };

    closeApp = (req: Request, res: Response) => {
        this.service.closeApp()
            .then(data => res.json(data))
            .catch(error => {
                console.error("Error closing app:", error);
                res.status(500).json({ error: "Internal Server Error" });
            });
    };

    enableAuto = (req: Request, res: Response) => {
        this.service.enableAutoMode()
            .then(data => res.json(data))
            .catch(error => {
                console.error("Error enabling auto mode:", error);
                res.status(500).json({ error: "Internal Server Error" });
            });
    };
}
