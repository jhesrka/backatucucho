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

    updateLogo = (req: Request, res: Response) => {
        const { masterPin } = req.body;
        this.service.updateAppLogo(masterPin, req.file)
            .then(data => res.json(data))
            .catch(error => {
                if (error instanceof CustomError) return res.status(error.statusCode).json({ error: error.message });
                console.error("Error updating logo:", error);
                res.status(500).json({ error: "Internal Server Error" });
            });
    };

    updateFavicon = (req: Request, res: Response) => {
        const { masterPin } = req.body;
        this.service.updateAppFavicon(masterPin, req.file)
            .then(data => res.json(data))
            .catch(error => {
                if (error instanceof CustomError) return res.status(error.statusCode).json({ error: error.message });
                console.error("Error updating favicon:", error);
                res.status(500).json({ error: "Internal Server Error" });
            });
    };

    getManifest = (req: Request, res: Response) => {
        this.service.getSettings()
            .then(settings => {
                const manifest = {
                    name: settings.appName || "Atucucho Shop",
                    short_name: "Atucucho",
                    id: "/",
                    description: "Atucucho Shop es la plataforma ideal para registrar tu negocio, publicar tus productos y llegar a más clientes.",
                    theme_color: "#0a192f",
                    background_color: "#ffffff",
                    display: "standalone",
                    scope: "/",
                    start_url: "/",
                    orientation: "portrait",
                    display_override: ["window-controls-overlay", "minimal-ui"],
                    icons: settings.appFaviconUrl ? [
                        {
                            src: settings.appFaviconUrl,
                            sizes: "192x192",
                            type: "image/webp",
                            purpose: "any"
                        },
                        {
                            src: settings.appFaviconUrl,
                            sizes: "512x512",
                            type: "image/webp",
                            purpose: "any"
                        },
                        {
                            src: settings.appFaviconUrl,
                            sizes: "512x512",
                            type: "image/webp",
                            purpose: "maskable"
                        }
                    ] : [
                        {
                            src: "/logo_resized_192x192.png",
                            sizes: "192x192",
                            type: "image/png",
                            purpose: "any"
                        },
                        {
                            src: "/logo_resized_512x512.png",
                            sizes: "512x512",
                            type: "image/png",
                            purpose: "any"
                        },
                        {
                            src: "/logo_resized_512x512.png",
                            sizes: "512x512",
                            type: "image/png",
                            purpose: "maskable"
                        }
                    ]
                };
                res.json(manifest);
            })
            .catch(error => {
                console.error("Error in getManifest:", error);
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
