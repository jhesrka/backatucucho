import { Post, StatusPost, Storie, StatusStorie, User, Status as UserStatus } from "../../data";
import { CustomError } from "../../domain";
import { ModerationLogService } from "./moderation-log.service";
import { PostReport } from "../../data/postgres/models/PostReport";
import { StorieReport } from "../../data/postgres/models/StorieReport";
import { getIO } from "../../config/socket";

export class AdminModerationService {
    constructor(
        private readonly moderationLogService: ModerationLogService
    ) { }

    async blockPost(adminId: string, postId: string, comment: string) {
        const post = await Post.findOne({ where: { id: postId }, relations: ["user"] });
        if (!post) throw CustomError.notFound("Post no encontrado");

        post.statusPost = StatusPost.HIDDEN;
        await post.save();

        // Limpiar reportes al procesar
        await PostReport.delete({ post: { id: postId } });

        // Apply sanction to user
        await this.applySanction(adminId, post.user.id, comment, postId);

        // Log action
        await this.moderationLogService.logAction({
            adminId,
            userId: post.user.id,
            postId,
            action: "BLOCK_CONTENT",
            comment
        });

        getIO().emit("postChanged", { action: "hidden", postId });
        return { message: "Publicación bloqueada e infracción aplicada." };
    }

    async blockStorie(adminId: string, storieId: string, comment: string) {
        const storie = await Storie.findOne({ where: { id: storieId }, relations: ["user"] });
        if (!storie) throw CustomError.notFound("Historia no encontrada");

        storie.statusStorie = StatusStorie.HIDDEN;
        await storie.save();

        // Limpiar reportes al procesar
        await StorieReport.delete({ storie: { id: storieId } });

        await this.applySanction(adminId, storie.user.id, comment, undefined, storieId);

        await this.moderationLogService.logAction({
            adminId,
            userId: storie.user.id,
            storieId,
            action: "BLOCK_CONTENT_STORIE",
            comment
        });

        getIO().emit("storieChanged", { action: "hidden", storieId });
        return { message: "Historia bloqueada e infracción aplicada." };
    }

    async restorePost(adminId: string, postId: string, comment: string) {
        const post = await Post.findOne({ where: { id: postId }, relations: ["user"] });
        if (!post) throw CustomError.notFound("Post no encontrado");

        post.statusPost = StatusPost.PUBLISHED;
        await post.save();

        // Eliminar reportes
        await PostReport.delete({ post: { id: postId } });

        // Revierte sanción
        if (post.user.warnings_count > 0) {
            post.user.warnings_count -= 1;
            if (post.user.status === UserStatus.SUSPENDED || post.user.status === UserStatus.BANNED) {
                post.user.status = UserStatus.ACTIVE;
                post.user.suspension_until = null!;
            }
            await post.user.save();
        }

        await this.moderationLogService.logAction({
            adminId,
            userId: post.user.id,
            postId,
            action: "RESTORE_CONTENT",
            comment
        });

        getIO().emit("postChanged", { action: "restore", postId });
        return { message: "Publicación restituida y sanción ajustada." };
    }

    async restoreStorie(adminId: string, storieId: string, comment: string) {
        const storie = await Storie.findOne({ where: { id: storieId }, relations: ["user"] });
        if (!storie) throw CustomError.notFound("Historia no encontrada");

        storie.statusStorie = StatusStorie.PUBLISHED;
        await storie.save();

        // Eliminar reportes
        await StorieReport.delete({ storie: { id: storieId } });

        if (storie.user.warnings_count > 0) {
            storie.user.warnings_count -= 1;
            if (storie.user.status === UserStatus.SUSPENDED || storie.user.status === UserStatus.BANNED) {
                storie.user.status = UserStatus.ACTIVE;
                storie.user.suspension_until = null!;
            }
            await storie.user.save();
        }

        await this.moderationLogService.logAction({
            adminId,
            userId: storie.user.id,
            storieId,
            action: "RESTORE_CONTENT_STORIE",
            comment
        });

        getIO().emit("storieChanged", { action: "restore", storieId });
        return { message: "Historia restituida y sanción ajustada." };
    }

    private async applySanction(adminId: string, userId: string, comment: string, postId?: string, storieId?: string) {
        const user = await User.findOne({ where: { id: userId } });
        if (!user) return;

        user.warnings_count += 1;

        if (user.warnings_count === 1) {
            // Advertencia visual (ya está en warnings_count)
            // Podríamos enviar notificación
        } else if (user.warnings_count === 2) {
            user.status = UserStatus.SUSPENDED;
            user.suspension_until = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h
        } else if (user.warnings_count === 3) {
            user.status = UserStatus.SUSPENDED;
            user.suspension_until = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
        } else if (user.warnings_count >= 4) {
            user.status = UserStatus.BANNED;
        }

        await user.save();

        getIO().emit("userStatusChanged", {
            userId: user.id,
            status: user.status,
            suspension_until: user.suspension_until
        });
    }

    async changeUserStatus(adminId: string, userId: string, newStatus: UserStatus, comment: string, postId?: string, storieId?: string) {
        const user = await User.findOne({ where: { id: userId } });
        if (!user) throw CustomError.notFound("Usuario no encontrado");

        user.status = newStatus;
        if (newStatus === UserStatus.ACTIVE) {
            user.suspension_until = null!;
            user.warnings_count = 0; // Reset as requested
        }

        await user.save();

        await this.moderationLogService.logAction({
            adminId,
            userId: user.id,
            postId,
            storieId,
            action: `CHANGE_USER_STATUS_${newStatus}`,
            comment
        });

        getIO().emit("userStatusChanged", { userId: user.id, status: user.status });
        return { message: `Estado de usuario cambiado a ${newStatus}.` };
    }
}
