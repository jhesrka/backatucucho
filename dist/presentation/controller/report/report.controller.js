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
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 5;
            this.service.findAllReports({ page, limit })
                .then(data => res.json(data))
                .catch(error => {
                console.error("DEBUG REPORT ERROR:", error);
                // Temporary debug log
                require('fs').appendFileSync('tmp/report_error.log', new Date().toISOString() + ": " + (error.stack || error.message || JSON.stringify(error)) + "\n");
                res.status(500).json({ message: "Internal Server Error", error: error.message });
            });
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
        this.deleteReport = (req, res) => {
            const { id } = req.params;
            this.service.deleteReport(id)
                .then(data => res.json(data))
                .catch(error => res.status(400).json({ message: error.message || "Internal Server Error" }));
        };
    }
}
exports.ReportController = ReportController;
