"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReportController = void 0;
class ReportController {
    constructor(service) {
        this.service = service;
        this.createReport = (req, res) => {
            const userId = req.body.sessionUser.id;
            const { type, description } = req.body;
            if (!type || !description)
                return res.status(400).json({ message: "Type and description are required" });
            this.service.createReport(userId, { type, description })
                .then(data => res.status(201).json(data))
                .catch(error => res.status(500).json({ message: "Internal Server Error" }));
        };
        this.getAllReports = (req, res) => {
            this.service.findAllReports()
                .then(data => res.json(data))
                .catch(error => res.status(500).json({ message: "Internal Server Error" }));
        };
        this.updateStatus = (req, res) => {
            const { id } = req.params;
            const { status } = req.body;
            if (!status)
                return res.status(400).json({ message: "Status is required" });
            this.service.updateReportStatus(id, status)
                .then(data => res.json(data))
                .catch(error => res.status(500).json({ message: "Internal Server Error" }));
        };
    }
}
exports.ReportController = ReportController;
