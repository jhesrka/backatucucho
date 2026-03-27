import { User } from "../../data/postgres/models/user.model";
import { CustomError } from "../../domain";

export class ActivityService {
    async ping(userId: string) {
        try {
            const user = await User.findOne({ where: { id: userId } });
            if (!user) throw CustomError.notFound("Usuario no encontrado");

            user.lastSeenAt = new Date();
            await user.save();
            
            return { ok: true };
        } catch (error) {
            throw error;
        }
    }

    async getOnlineStats() {
        try {
            const now = new Date();
            // America/Guayaquil fix
            const utcMinus5 = new Date(now.getTime() - (5 * 60 * 60 * 1000));
            
            // Connected Today: Unique users with activity today (Ecuador time)
            const todayStart = new Date(utcMinus5);
            todayStart.setHours(0, 0, 0, 0);
            const todayStartUTC = new Date(todayStart.getTime() + (5 * 60 * 60 * 1000));

            const connectedToday = await User.createQueryBuilder("user")
                .where("user.lastSeenAt >= :start", { start: todayStartUTC })
                .getCount();

            // Online Now: Active in the last 2 minutes
            const twoMinutesAgo = new Date(now.getTime() - (2 * 60 * 1000));
            const onlineNow = await User.createQueryBuilder("user")
                .where("user.lastSeenAt >= :minAgo", { minAgo: twoMinutesAgo })
                .getCount();

            return {
                connectedToday,
                onlineNow
            };
        } catch (error) {
            console.error("Error in getOnlineStats:", error);
            return { connectedToday: 0, onlineNow: 0 };
        }
    }
}
