import { Request, Response } from "express";
import { ReportService } from "../../services/report/report.service";

export class ReportController {
    constructor(private readonly service: ReportService) { }

    createReport = (req: Request, res: Response) => {
        const userId = req.body.sessionUser.id;
        const { type, description } = req.body;

        if (!type || !description) return res.status(400).json({ message: "Type and description are required" });

        this.service.createReport(userId, { type, description })
            .then(data => res.status(201).json(data))
            .catch(error => res.status(500).json({ message: "Internal Server Error" }));
    };

    getAllReports = (req: Request, res: Response) => {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 5;

        this.service.findAllReports({ page, limit })
            .then(data => res.json(data))
            .catch(error => {
                console.error("DEBUG REPORT ERROR:", error);
                // Temporary debug log
                require('fs').appendFileSync('tmp/report_error.log', new Date().toISOString() + ": " + (error.stack || error.message || JSON.stringify(error)) + "\n");
                res.status(500).json({ message: "Internal Server Error", error: error.message });
            });
    };

    updateStatus = (req: Request, res: Response) => {
        const { id } = req.params;
        const { status } = req.body;

        if (!status) return res.status(400).json({ message: "Status is required" });

        this.service.updateReportStatus(id, status)
            .then(data => res.json(data))
            .catch(error => res.status(500).json({ message: "Internal Server Error" }));
    };

    deleteReport = (req: Request, res: Response) => {
        const { id } = req.params;

        this.service.deleteReport(id)
            .then(data => res.json(data))
            .catch(error => res.status(400).json({ message: error.message || "Internal Server Error" }));
    };
}
