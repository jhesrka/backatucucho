import {
    BaseEntity,
    Column,
    CreateDateColumn,
    Entity,
    ManyToOne,
    PrimaryGeneratedColumn,
} from "typeorm";
import { Campaign } from "./Campaign";
import { User } from "./user.model";

export enum LogStatus {
    SENT = "SENT",
    FAILED = "FAILED",
    PENDING = "PENDING", // If pre-generated
}

@Entity()
export class CampaignLog extends BaseEntity {
    @PrimaryGeneratedColumn("uuid")
    id: string;

    @ManyToOne(() => Campaign, (campaign) => campaign.logs)
    campaign: Campaign;

    // Use a string for userID in case target is not in User table (rare, but flexible)
    // But strictly, let's link to User for integrity if user exists.
    @ManyToOne(() => User, { nullable: true })
    user: User;

    @Column({ nullable: true })
    targetContact: string; // Email or Phone used

    @Column({ type: "enum", enum: LogStatus })
    status: LogStatus;

    @Column("text", { nullable: true })
    errorMessage: string;

    @CreateDateColumn()
    attemptedAt: Date;
}
