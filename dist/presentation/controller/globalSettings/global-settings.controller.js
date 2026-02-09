"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GlobalSettingsController = void 0;
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
            this.service.updateSettings(req.body)
                .then(data => res.json(data))
                .catch(error => res.status(500).json({ error: "Internal Server Error" }));
        };
    }
}
exports.GlobalSettingsController = GlobalSettingsController;
