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
            return report;
        });
    }
    findAllReports() {
        return __awaiter(this, void 0, void 0, function* () {
            const reports = yield data_1.Report.find({
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
        });
    }
    updateReportStatus(id, status) {
        return __awaiter(this, void 0, void 0, function* () {
            const report = yield data_1.Report.findOne({ where: { id } });
            if (!report)
                throw domain_1.CustomError.notFound("Report not found");
            report.status = status;
            yield report.save();
            return report;
        });
    }
}
exports.ReportService = ReportService;
