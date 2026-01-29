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
        return report;
    }

    async findAllReports() {
        const reports = await Report.find({
            relations: ["user"],
            order: { createdAt: "DESC" },
        });
        return reports.map(r => ({
            id: r.id,
            type: r.type,
            description: r.description,
            status: r.status,
            createdAt: r.createdAt,
            user: {
                id: r.user.id,
                name: r.user.name,
                surname: r.user.surname,
                email: r.user.email,
                phone: r.user.whatsapp
            }
        }));
    }

    async updateReportStatus(id: string, status: ReportStatus) {
        const report = await Report.findOne({ where: { id } });
        if (!report) throw CustomError.notFound("Report not found");

        report.status = status;
        await report.save();
        return report;
    }
}
