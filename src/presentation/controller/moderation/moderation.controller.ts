import { Request, Response } from "express";
import { AdminModerationService } from "../../services/admin-moderation.service";
import { PostReportService } from "../../services/post-report.service";
import { ModerationLogService } from "../../services/moderation-log.service";
import { CustomError } from "../../../domain";
import { Status as UserStatus } from "../../../data/postgres/models/user.model";
import { ReportReason } from "../../../data/postgres/models/PostReport";

export class ModerationController {
    constructor(
        private readonly adminModerationService: AdminModerationService,
        private readonly postReportService: PostReportService,
        private readonly moderationLogService: ModerationLogService
    ) { }

    private handleError = (error: unknown, res: Response) => {
        if (error instanceof CustomError) {
            return res.status(error.statusCode).json({ error: error.message });
        }
        console.error(error);
        return res.status(500).json({ error: "Internal Server Error" });
    };

    reportPost = (req: Request, res: Response) => {
        const userId = req.body.sessionUser.id;
        const { postId, reason } = req.body;

        this.postReportService.reportPost(userId, postId, reason as ReportReason)
            .then((result: any) => res.json(result))
            .catch((error: any) => this.handleError(error, res));
    };

    reportStorie = (req: Request, res: Response) => {
        const userId = req.body.sessionUser.id;
        const { storieId, reason } = req.body;

        this.postReportService.reportStorie(userId, storieId, reason as ReportReason)
            .then((result: any) => res.json(result))
            .catch((error: any) => this.handleError(error, res));
    };

    blockPost = (req: Request, res: Response) => {
        const adminId = req.body.user.id;
        const { postId, comment } = req.body;

        if (!comment) return res.status(400).json({ error: "El comentario es obligatorio" });

        this.adminModerationService.blockPost(adminId, postId, comment)
            .then((result: any) => res.json(result))
            .catch((error: any) => this.handleError(error, res));
    };

    blockStorie = (req: Request, res: Response) => {
        const adminId = req.body.user.id;
        const { storieId, comment } = req.body;

        if (!comment) return res.status(400).json({ error: "El comentario es obligatorio" });

        this.adminModerationService.blockStorie(adminId, storieId, comment)
            .then((result: any) => res.json(result))
            .catch((error: any) => this.handleError(error, res));
    };

    restorePost = (req: Request, res: Response) => {
        const adminId = req.body.user.id;
        const { postId, comment } = req.body;

        this.adminModerationService.restorePost(adminId, postId, comment)
            .then((result: any) => res.json(result))
            .catch((error: any) => this.handleError(error, res));
    };

    restoreStorie = (req: Request, res: Response) => {
        const adminId = req.body.user.id;
        const { storieId, comment } = req.body;

        this.adminModerationService.restoreStorie(adminId, storieId, comment)
            .then((result: any) => res.json(result))
            .catch((error: any) => this.handleError(error, res));
    };

    changeUserStatus = (req: Request, res: Response) => {
        const adminId = req.body.user.id;
        const { userId, status, comment, postId, storieId } = req.body;

        if (!comment) return res.status(400).json({ error: "El comentario es obligatorio" });

        this.adminModerationService.changeUserStatus(adminId, userId, status as UserStatus, comment, postId, storieId)
            .then((result: any) => res.json(result))
            .catch((error: any) => this.handleError(error, res));
    };

    getLogs = (req: Request, res: Response) => {
        this.moderationLogService.getAllLogs()
            .then((logs: any) => res.json(logs))
            .catch((error: any) => this.handleError(error, res));
    };

    getAllReports = (req: Request, res: Response) => {
        this.postReportService.getAllReports()
            .then((reports: any) => res.json(reports))
            .catch((error: any) => this.handleError(error, res));
    };

    getAllStorieReports = (req: Request, res: Response) => {
        this.postReportService.fetchAllStorieReports()
            .then((reports: any) => res.json(reports))
            .catch((error: any) => this.handleError(error, res));
    };
}
