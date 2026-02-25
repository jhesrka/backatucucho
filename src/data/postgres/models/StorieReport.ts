import { BaseEntity, Column, Entity, ManyToOne, PrimaryGeneratedColumn, CreateDateColumn } from "typeorm";
import { User } from "./user.model";
import { Storie } from "./stories.model";
import { ReportReason } from "./PostReport";
import { ReportStatus } from "./report.model"; // Reuse ReportStatus

@Entity()
export class StorieReport extends BaseEntity {
    @PrimaryGeneratedColumn("uuid")
    id: string;

    @ManyToOne(() => User)
    reporter: User;

    @ManyToOne(() => Storie)
    storie: Storie;

    @Column("enum", { enum: ReportReason })
    reason: ReportReason;

    @Column("enum", { enum: ReportStatus, default: ReportStatus.PENDING })
    status: ReportStatus;

    @CreateDateColumn()
    createdAt: Date;
}
