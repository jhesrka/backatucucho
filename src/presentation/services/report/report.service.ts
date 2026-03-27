import { Report, ReportStatus, ReportType, User } from "../../../data";
import { CustomError } from "../../../domain";

export class ReportService {
    async createReport(userId: string, data: { type: ReportType; description: string }) {
        const user = await User.findOne({ where: { id: userId } });
        if (!user) throw CustomError.notFound("User not found");

        const report = new Report();
        report.user = user;
        report.type = data.type;
        report.description = data.description;
        report.status = ReportStatus.PENDING;

        await report.save();
        
        // Emit update to admin
        try {
            const { getIO } = require("../../../config/socket");
            getIO().emit("report_count_updated");
        } catch (e) {}

        return report;
    }

    async findAllReports(filters: { page?: number; limit?: number } = {}) {
        const { page = 1, limit = 5 } = filters;
        const offset = (page - 1) * limit;

        const [reports, total] = await Report.findAndCount({
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
    }

    async updateReportStatus(id: string, status: ReportStatus) {
        const report = await Report.findOne({ where: { id }, relations: ["user"] });
        if (!report) throw CustomError.notFound("Report not found");

        const oldStatus = report.status;
        report.status = status;
        
        if (status === ReportStatus.RESOLVED && oldStatus !== ReportStatus.RESOLVED) {
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
            } catch (e) {}
        }

        await report.save();

        // Emit update to all admins for the badge and the list
        try {
            const { getIO } = require("../../../config/socket");
            getIO().emit("report_count_updated");
            getIO().emit("support_ticket_status_changed", { id, status });
        } catch (e) {}

        return report;
    }

    async getPendingCount() {
        return await Report.count({ where: { status: ReportStatus.PENDING } });
    }

    async deleteReport(id: string) {
        const report = await Report.findOne({ where: { id } });
        if (!report) throw new Error("Report not found");
        
        // Although the frontend will check, the backend is the source of truth
        if (report.status !== ReportStatus.RESOLVED) {
            throw new Error("Only resolved reports can be deleted");
        }

        await report.remove();

        // Emit update to all admins for the badge
        try {
            const { getIO } = require("../../../config/socket");
            getIO().emit("report_count_updated");
        } catch (e) {}

        return { message: "Report deleted successfully" };
    }
}
