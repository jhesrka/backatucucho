import {
    BaseEntity,
    Column,
    CreateDateColumn,
    Entity,
    OneToMany,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
} from "typeorm";
import { CampaignLog } from "./CampaignLog";

export enum CampaignType {
    EMAIL = "EMAIL",
    WHATSAPP = "WHATSAPP",
}

export enum CampaignStatus {
    DRAFT = "DRAFT",
    PENDING = "PENDING",
    PROCESSING = "PROCESSING",
    PAUSED = "PAUSED",
    COMPLETED = "COMPLETED",
    FAILED = "FAILED",
}

@Entity()
export class Campaign extends BaseEntity {
    @PrimaryGeneratedColumn("uuid")
    id: string;

    @Column({ type: "enum", enum: CampaignType })
    type: CampaignType;

    @Column({ type: "enum", enum: CampaignStatus, default: CampaignStatus.DRAFT })
    status: CampaignStatus;

    // For Email
    @Column({ nullable: true })
    subject: string;

    @Column({ nullable: true })
    name: string;

    // Content for both (HTML for email, plain for WA)
    @Column("text")
    content: string;

    @Column({ nullable: true })
    mediaUrl: string;

    @Column({ nullable: true })
    mediaType: string;

    // JSON storing criteria: { role: 'USER', status: 'ACTIVE', ... }
    @Column("jsonb", { nullable: true })
    filters: any;

    @Column("int", { default: 0 })
    totalTargets: number;

    @Column("int", { default: 0 })
    sentCount: number;

    @Column("int", { default: 0 })
    failedCount: number;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;

    @OneToMany(() => CampaignLog, (log) => log.campaign)
    logs: CampaignLog[];
}
