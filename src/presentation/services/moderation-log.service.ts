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
        await ModerationLog.cleanupOldLogs(user.id);
    }

    async getLogsByUser(userId: string) {
        return await ModerationLog.find({
            where: { user: { id: userId } },
            order: { createdAt: "DESC" }
        });
    }

    async getLogs(userId?: string, page: number = 1, limit: number = 10) {
        const whereClause = userId ? { user: { id: userId } } : {};
        const skip = (page - 1) * limit;

        const [logs, total] = await ModerationLog.findAndCount({
            where: whereClause,
            relations: ["user", "post", "storie"],
            order: { createdAt: "DESC" },
            take: limit,
            skip: skip
        });

        return {
            success: true,
            logs,
            total,
            currentPage: page,
            totalPages: Math.ceil(total / limit)
        };
    }
}
