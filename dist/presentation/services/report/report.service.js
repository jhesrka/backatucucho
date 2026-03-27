"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReportService = void 0;
const data_1 = require("../../../data");
const domain_1 = require("../../../domain");
class ReportService {
    createReport(userId, data) {
        return __awaiter(this, void 0, void 0, function* () {
            const user = yield data_1.User.findOne({ where: { id: userId } });
            if (!user)
                throw domain_1.CustomError.notFound("User not found");
            const report = new data_1.Report();
            report.user = user;
            report.type = data.type;
            report.description = data.description;
            report.status = data_1.ReportStatus.PENDING;
            yield report.save();
            // Emit update to admin
            try {
                const { getIO } = require("../../../config/socket");
                getIO().emit("report_count_updated");
            }
            catch (e) { }
            return report;
        });
    }
    findAllReports() {
        return __awaiter(this, arguments, void 0, function* (filters = {}) {
            const { page = 1, limit = 5 } = filters;
            const offset = (page - 1) * limit;
            const [reports, total] = yield data_1.Report.findAndCount({
                relations: ["user"],
                order: { createdAt: "DESC" },
                take: Number(limit),
                skip: Number(offset)
            });
            return {
                reports: reports.map(r => ({
                    id: r.id,
                    type: r.type,
                    description: r.description,
                    status: r.status,
                    createdAt: r.createdAt,
                    resolvedAt: r.resolvedAt,
                    user: r.user ? {
                        id: r.user.id,
                        name: r.user.name,
                        surname: r.user.surname,
                        email: r.user.email,
                        phone: r.user.whatsapp
                    } : {
                        id: 'N/A',
                        name: 'Desconocido',
                        surname: '',
                        email: 'N/A',
                        phone: 'N/A'
                    }
                })),
                totalPages: Math.ceil((total || 0) / (limit || 1)),
                totalReports: total || 0
            };
        });
    }
    updateReportStatus(id, status) {
        return __awaiter(this, void 0, void 0, function* () {
            const report = yield data_1.Report.findOne({ where: { id }, relations: ["user"] });
            if (!report)
                throw domain_1.CustomError.notFound("Report not found");
            const oldStatus = report.status;
            report.status = status;
            if (status === data_1.ReportStatus.RESOLVED && oldStatus !== data_1.ReportStatus.RESOLVED) {
                report.resolvedAt = new Date();
                // Notify user
                try {
                    const { getIO } = require("../../../config/socket");
                    getIO().to(report.user.id).emit("notification", {
                        title: "Soporte Técnico ✅",
                        message: "Tu reporte ha sido resuelto. Gracias por ayudarnos a mejorar Atucucho Shop.",
                        type: "SUCCESS",
                        createdAt: new Date()
                    });
                }
                catch (e) { }
            }
            yield report.save();
            // Emit update to all admins for the badge and the list
            try {
                const { getIO } = require("../../../config/socket");
                getIO().emit("report_count_updated");
                getIO().emit("support_ticket_status_changed", { id, status });
            }
            catch (e) { }
            return report;
        });
    }
    getPendingCount() {
        return __awaiter(this, void 0, void 0, function* () {
            return yield data_1.Report.count({ where: { status: data_1.ReportStatus.PENDING } });
        });
    }
    deleteReport(id) {
        return __awaiter(this, void 0, void 0, function* () {
            const report = yield data_1.Report.findOne({ where: { id } });
            if (!report)
                throw new Error("Report not found");
            // Although the frontend will check, the backend is the source of truth
            if (report.status !== data_1.ReportStatus.RESOLVED) {
                throw new Error("Only resolved reports can be deleted");
            }
            yield report.remove();
            // Emit update to all admins for the badge
            try {
                const { getIO } = require("../../../config/socket");
                getIO().emit("report_count_updated");
            }
            catch (e) { }
            return { message: "Report deleted successfully" };
        });
    }
}
exports.ReportService = ReportService;
