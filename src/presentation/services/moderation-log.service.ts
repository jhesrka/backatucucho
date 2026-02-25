import { ModerationLog, User } from "../../data";

export class ModerationLogService {
    async logAction(data: {
        adminId: string;
        userId: string;
        postId?: string;
        storieId?: string;
        action: string;
        comment: string;
    }) {
        const user = await User.findOne({ where: { id: data.userId } });
        if (!user) return;

        const log = new ModerationLog();
        log.adminId = data.adminId;
        log.user = user;
        log.postId = data.postId || null!;
        log.storieId = data.storieId || null!;
        log.action = data.action;
        log.comment = data.comment;
        await log.save();
    }

    async getLogsByUser(userId: string) {
        return await ModerationLog.find({
            where: { user: { id: userId } },
            order: { createdAt: "DESC" }
        });
    }

    async getAllLogs() {
        return await ModerationLog.find({
            relations: ["user", "post", "storie"],
            order: { createdAt: "DESC" }
        });
    }
}
