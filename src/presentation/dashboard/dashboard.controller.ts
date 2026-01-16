import { Request, Response } from "express";
import { DashboardService } from "../services/dashboard.service";
import { CustomError } from "../../domain";

export class DashboardController {
    constructor(private readonly dashboardService: DashboardService) { }

    private handleError = (error: unknown, res: Response) => {
        if (error instanceof CustomError) {
            return res.status(error.statusCode).json({ message: error.message });
        }
        const fs = require('fs');
        console.error("Dashboard Error details:", error);
        fs.appendFileSync('dashboard_debug.txt', `${new Date().toISOString()} - CONTROLLER ERROR: ${String(error)}\n${JSON.stringify(error, null, 2)}\n`);
        return res.status(500).json({ message: "Internal Server Error", error: String(error) });
    };

    getStats = (req: Request, res: Response) => {
        this.dashboardService
            .getAdminStats()
            .then((stats) => res.json(stats))
            .catch((error) => this.handleError(error, res));
    };
}
