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
        this.service.findAllReports()
            .then(data => res.json(data))
            .catch(error => res.status(500).json({ message: "Internal Server Error" }));
    };

    updateStatus = (req: Request, res: Response) => {
        const { id } = req.params;
        const { status } = req.body;

        if (!status) return res.status(400).json({ message: "Status is required" });

        this.service.updateReportStatus(id, status)
            .then(data => res.json(data))
            .catch(error => res.status(500).json({ message: "Internal Server Error" }));
    };
}
