"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GlobalSettingsController = void 0;
const domain_1 = require("../../../domain");
class GlobalSettingsController {
    constructor(service) {
        this.service = service;
        this.getSettings = (req, res) => {
            this.service.getSettings()
                .then(data => res.json(data))
                .catch(error => {
                console.error("Error in getSettings:", error);
                res.status(500).json({ error: "Internal Server Error" });
            });
        };
        this.updateSettings = (req, res) => {
            this.service.updateSettings(req.body, req.file)
                .then(data => res.json(data))
                .catch(error => {
                if (error instanceof domain_1.CustomError)
                    return res.status(error.statusCode).json({ error: error.message });
                console.error("Error updating settings:", error);
                res.status(500).json({ error: "Internal Server Error" });
            });
        };
        this.updateLogo = (req, res) => {
            const { masterPin } = req.body;
            this.service.updateAppLogo(masterPin, req.file)
                .then(data => res.json(data))
                .catch(error => {
                if (error instanceof domain_1.CustomError)
                    return res.status(error.statusCode).json({ error: error.message });
                console.error("Error updating logo:", error);
                res.status(500).json({ error: "Internal Server Error" });
            });
        };
        this.updateFavicon = (req, res) => {
            const { masterPin } = req.body;
            this.service.updateAppFavicon(masterPin, req.file)
                .then(data => res.json(data))
                .catch(error => {
                if (error instanceof domain_1.CustomError)
                    return res.status(error.statusCode).json({ error: error.message });
                console.error("Error updating favicon:", error);
                res.status(500).json({ error: "Internal Server Error" });
            });
        };
        this.getManifest = (req, res) => {
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
        this.closeApp = (req, res) => {
            const { masterPin } = req.body;
            this.service.closeApp(masterPin)
                .then(data => res.json(data))
                .catch(error => {
                if (error instanceof domain_1.CustomError)
                    return res.status(error.statusCode).json({ error: error.message });
                console.error("Error closing app:", error);
                res.status(500).json({ error: "Internal Server Error" });
            });
        };
        this.enableAuto = (req, res) => {
            const { masterPin } = req.body;
            this.service.enableAutoMode(masterPin)
                .then(data => res.json(data))
                .catch(error => {
                if (error instanceof domain_1.CustomError)
                    return res.status(error.statusCode).json({ error: error.message });
                console.error("Error enabling auto mode:", error);
                res.status(500).json({ error: "Internal Server Error" });
            });
        };
    }
}
exports.GlobalSettingsController = GlobalSettingsController;
