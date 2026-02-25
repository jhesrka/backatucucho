import { BaseEntity, Column, Entity, ManyToOne, PrimaryGeneratedColumn, CreateDateColumn } from "typeorm";
import { User } from "./user.model";
import { Post } from "./post.model";
import { ReportStatus } from "./report.model"; // Reuse ReportStatus

export enum ReportReason {
    SEXUAL = "SEXUAL",
    VIOLENT = "VIOLENT",
    OFFENSIVE = "OFFENSIVE",
    SCAM = "SCAM",
    OTHER = "OTHER"
}

@Entity()
export class PostReport extends BaseEntity {
    @PrimaryGeneratedColumn("uuid")
    id: string;

    @ManyToOne(() => User)
    reporter: User;

    @ManyToOne(() => Post)
    post: Post;

    @Column("enum", { enum: ReportReason })
    reason: ReportReason;

    @Column("enum", { enum: ReportStatus, default: ReportStatus.PENDING })
    status: ReportStatus;

    @CreateDateColumn()
    createdAt: Date;
}
