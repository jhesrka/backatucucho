import { BaseEntity, Column, CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { User } from "./user.model";

export enum NotificationType {
    SECURITY = "SECURITY",
    INFO = "INFO",
    WARNING = "WARNING"
}

@Entity()
export class AdminNotification extends BaseEntity {
    @PrimaryGeneratedColumn("uuid")
    id: string;

    @Column("text")
    message: string;

    @Column("enum", { enum: NotificationType, default: NotificationType.INFO })
    type: NotificationType;

    @Column("varchar", { nullable: true })
    ip: string;

    @Column("varchar", { nullable: true })
    country: string;

    @ManyToOne(() => User, { nullable: true })
    relatedUser: User;

    @CreateDateColumn()
    createdAt: Date;
}
