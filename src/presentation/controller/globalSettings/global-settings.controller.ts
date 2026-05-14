import { Request, Response } from "express";
import { GlobalSettingsService } from "../../services/globalSettings/global-settings.service";
import { CustomError } from "../../../domain";

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
        this.service.updateSettings(req.body, req.file)
            .then(data => res.json(data))
            .catch(error => {
                if (error instanceof CustomError) return res.status(error.statusCode).json({ error: error.message });
                console.error("Error updating settings:", error);
                res.status(500).json({ error: "Internal Server Error" });
            });
    };

    closeApp = (req: Request, res: Response) => {
        const { masterPin } = req.body;
        this.service.closeApp(masterPin)
            .then(data => res.json(data))
            .catch(error => {
                if (error instanceof CustomError) return res.status(error.statusCode).json({ error: error.message });
                console.error("Error closing app:", error);
                res.status(500).json({ error: "Internal Server Error" });
            });
    };

    enableAuto = (req: Request, res: Response) => {
        const { masterPin } = req.body;
        this.service.enableAutoMode(masterPin)
            .then(data => res.json(data))
            .catch(error => {
                if (error instanceof CustomError) return res.status(error.statusCode).json({ error: error.message });
                console.error("Error enabling auto mode:", error);
                res.status(500).json({ error: "Internal Server Error" });
            });
    };
}
