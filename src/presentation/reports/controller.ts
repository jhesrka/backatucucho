
import { Request, Response } from "express";
import { AdminReportService } from "../services/report/admin-report.service";
import { CustomError } from "../../domain";

export class AdminReportController {
    constructor(private readonly service: AdminReportService) { }

    private handleError = (error: unknown, res: Response) => {
        if (error instanceof CustomError) {
            return res.status(error.statusCode).json({ message: error.message });
        }
        console.error(error);
        return res.status(500).json({ message: "Internal Server Error" });
    };

    getAggregatedReports = (req: Request, res: Response) => {
        const filters = req.query; // page, limit, status, type, etc.
        this.service.getAggregatedReports(filters)
            .then((data: any) => res.json(data))
            .catch((error: any) => this.handleError(error, res));
    };

    getReportDetails = (req: Request, res: Response) => {
        const { type, id } = req.params;
        if (type !== 'POST' && type !== 'STORY') {
            return res.status(400).json({ message: "Invalid type. Must be POST or STORY" });
        }

        this.service.getReportDetails(id, type as 'POST' | 'STORY')
            .then((data: any) => res.json(data))
            .catch((error: any) => this.handleError(error, res));
    };

    resolveReport = (req: Request, res: Response) => {
        const { type, id } = req.params;
        const { action, comment } = req.body; // action: HIDE, RESTORE, DELETE

        if (type !== 'POST' && type !== 'STORY') {
            return res.status(400).json({ message: "Invalid type" });
        }
        if (!['HIDE', 'RESTORE', 'DELETE'].includes(action)) {
            return res.status(400).json({ message: "Invalid action" });
        }

        this.service.resolveReport(id, type as 'POST' | 'STORY', action, comment)
            .then((data: any) => res.json(data))
            .catch((error: any) => this.handleError(error, res));
    };

    getStatistics = (req: Request, res: Response) => {
        this.service.getStatistics()
            .then((data: any) => res.json(data))
            .catch((error: any) => this.handleError(error, res));
    };

    purgeOldReports = (req: Request, res: Response) => {
        const { days } = req.body;
        if (!days || isNaN(days)) return res.status(400).json({ message: "Days is required" });

        this.service.purgeOldReports(Number(days))
            .then((data: any) => res.json(data))
            .catch((error: any) => this.handleError(error, res));
    };

    // Get global pending counts (support + moderation)
    getGlobalPendingCount = (req: Request, res: Response) => {
        this.service.getGlobalPendingCount()
            .then((data: any) => res.json(data))
            .catch((error: any) => this.handleError(error, res));
    };
}
