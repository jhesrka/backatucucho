"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DashboardController = void 0;
const domain_1 = require("../../domain");
class DashboardController {
    constructor(dashboardService) {
        this.dashboardService = dashboardService;
        this.handleError = (error, res) => {
            if (error instanceof domain_1.CustomError) {
                return res.status(error.statusCode).json({ message: error.message });
            }
            const fs = require('fs');
            console.error("Dashboard Error details:", error);
            fs.appendFileSync('dashboard_debug.txt', `${new Date().toISOString()} - CONTROLLER ERROR: ${String(error)}\n${JSON.stringify(error, null, 2)}\n`);
            return res.status(500).json({ message: "Internal Server Error", error: String(error) });
        };
        this.getStats = (req, res) => {
            this.dashboardService
                .getAdminStats()
                .then((stats) => res.json(stats))
                .catch((error) => this.handleError(error, res));
        };
    }
}
exports.DashboardController = DashboardController;
