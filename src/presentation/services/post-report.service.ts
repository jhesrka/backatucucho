import { Post, PostReport, ReportReason, StatusPost, User, Storie, StorieReport, StatusStorie, ReportStatus } from "../../data";
import { CustomError } from "../../domain";
import { CONTENT_MODERATION_THRESHOLD } from "../../config/content-moderation";
import { getIO } from "../../config/socket";

export class PostReportService {
    async reportPost(reporterId: string, postId: string, reason: ReportReason) {
        // 1. Validar si ya reportó este post
        const existingReport = await PostReport.findOne({
            where: {
                reporter: { id: reporterId },
                post: { id: postId }
            }
        });

        if (existingReport) {
            throw CustomError.badRequest("Ya has reportado esta publicación.");
        }

        const post = await Post.findOne({ where: { id: postId }, relations: ["user"] });
        if (!post) throw CustomError.notFound("Publicación no encontrada");

        const reporter = await User.findOne({ where: { id: reporterId } });
        if (!reporter) throw CustomError.notFound("Usuario no encontrado");

        // 2. Crear reporte
        const report = new PostReport();
        report.reporter = reporter;
        report.post = post;
        report.reason = reason;
        await report.save();

        // 3. Verificar umbral (solo reportes pendientes)
        const reportCount = await PostReport.count({ where: { post: { id: postId }, status: ReportStatus.PENDING } });

        if (reportCount >= CONTENT_MODERATION_THRESHOLD) {
            post.statusPost = StatusPost.FLAGGED;
            await post.save();

            // Notify author
            getIO().emit("postChanged", {
                action: "flagged",
                postId: post.id,
                message: "Tu publicación está en revisión."
            });

            // Notify admin
            getIO().emit("adminNotification", {
                type: "POST_FLAGGED",
                postId: post.id,
                message: `La publicación ${post.id} ha alcanzado el umbral de reportes.`
            });
        }

        return { message: "Reporte enviado correctamente." };
    }

    async reportStorie(reporterId: string, storieId: string, reason: ReportReason) {
        const existingReport = await StorieReport.findOne({
            where: {
                reporter: { id: reporterId },
                storie: { id: storieId }
            }
        });

        if (existingReport) {
            throw CustomError.badRequest("Ya has reportado esta historia.");
        }

        const storie = await Storie.findOne({ where: { id: storieId }, relations: ["user"] });
        if (!storie) throw CustomError.notFound("Historia no encontrada");

        const reporter = await User.findOne({ where: { id: reporterId } });
        if (!reporter) throw CustomError.notFound("Usuario no encontrado");

        const report = new StorieReport();
        report.reporter = reporter;
        report.storie = storie;
        report.reason = reason;
        await report.save();

        const reportCount = await StorieReport.count({ where: { storie: { id: storieId }, status: ReportStatus.PENDING } });

        if (reportCount >= CONTENT_MODERATION_THRESHOLD) {
            storie.statusStorie = StatusStorie.FLAGGED;
            await storie.save();

            getIO().emit("storieChanged", {
                action: "flagged",
                storieId: storie.id,
                message: "Tu historia está en revisión."
            });

            getIO().emit("adminNotification", {
                type: "STORIE_FLAGGED",
                storieId: storie.id,
                message: `La historia ${storie.id} ha alcanzado el umbral de reportes.`
            });
        }

        return { message: "Reporte enviado correctamente." };
    }

    async getReportsByPost(postId: string) {
        return await PostReport.find({
            where: { post: { id: postId } },
            relations: ["reporter"],
            order: { createdAt: "DESC" }
        });
    }

    async getAllReports() {
        return await PostReport.find({
            relations: ["reporter", "post", "post.user"],
            order: { createdAt: "DESC" }
        });
    }

    async fetchAllStorieReports() {
        return await StorieReport.find({
            relations: ["reporter", "storie", "storie.user"],
            order: { createdAt: "DESC" }
        });
    }
}
