import { BaseEntity, Column, Entity, ManyToOne, PrimaryGeneratedColumn, CreateDateColumn, JoinColumn } from "typeorm";
import { User } from "./user.model";
import { Post } from "./post.model";
import { Storie } from "./stories.model";

@Entity()
export class ModerationLog extends BaseEntity {
    @PrimaryGeneratedColumn("uuid")
    id: string;

    @Column("uuid")
    adminId: string; // The admin who did the action

    @ManyToOne(() => User)
    user: User; // The user who was sanctioned or owns the content

    @Column("uuid", { nullable: true })
    postId: string;

    @ManyToOne(() => Post, { nullable: true })
    @JoinColumn({ name: "postId" })
    post: Post;

    @Column("uuid", { nullable: true })
    storieId: string;

    @ManyToOne(() => Storie, { nullable: true })
    @JoinColumn({ name: "storieId" })
    storie: Storie;

    @Column("varchar")
    action: string; // e.g., "BLOCK_CONTENT", "RESTORE_CONTENT", "SUSPEND_USER", "UNSUSPEND_USER"

    @Column("text")
    comment: string;

    @CreateDateColumn()
    createdAt: Date;

    static async cleanupOldLogs(userId: string) {
        try {
            const total = await this.count({ where: { user: { id: userId } } });
            if (total > 50) {
                const logsToDelete = total - 50;
                const oldLogs = await this.find({
                    where: { user: { id: userId } },
                    order: { createdAt: "ASC" },
                    take: logsToDelete
                });
                if (oldLogs.length > 0) {
                    const ids = oldLogs.map(log => log.id);
                    await this.delete(ids);
                }
            }
        } catch (e) {
            console.error("Error cleaning up moderation logs:", e);
        }
    }
}
