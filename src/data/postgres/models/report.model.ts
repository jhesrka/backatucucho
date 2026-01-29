import { BaseEntity, Column, Entity, ManyToOne, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from "typeorm";
import { User } from "./user.model";

export enum ReportStatus {
    PENDING = "PENDING",
    IN_REVIEW = "IN_REVIEW",
    RESOLVED = "RESOLVED"
}

export enum ReportType {
    BUG = "BUG",
    PAYMENT = "PAYMENT",
    CONTENT = "CONTENT",
    OTHER = "OTHER"
}

@Entity()
export class Report extends BaseEntity {
    @PrimaryGeneratedColumn("uuid")
    id: string;

    @ManyToOne(() => User, (user) => user.reports)
    user: User;

    @Column("enum", { enum: ReportType })
    type: ReportType;

    @Column("text")
    description: string;

    @Column("enum", { enum: ReportStatus, default: ReportStatus.PENDING })
    status: ReportStatus;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
