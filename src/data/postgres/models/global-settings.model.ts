import { BaseEntity, Column, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";

@Entity()
export class GlobalSettings extends BaseEntity {
    @PrimaryGeneratedColumn("uuid")
    id: string;

    @Column("int", { default: 20 })
    orderRetentionDays: number;

    @Column("varchar", { length: 60, nullable: true })
    masterPin?: string; // PIN de 4 dígitos hasheado con bcrypt (60 caracteres)

    @Column("int", { default: 5 })
    freePostsLimit: number;

    @Column("int", { default: 1 })
    freePostDurationDays: number;

    @Column("int", { default: 0 })
    freePostDurationHours: number;

    @Column("varchar", { length: 20, nullable: true })
    supportWhatsapp: string;

    @Column("text", { nullable: true })
    termsAndConditions: string;

    @Column("text", { nullable: true })
    privacyPolicy: string;

    // Subscription BASIC Configuration
    @Column("decimal", { precision: 10, scale: 2, default: 5.00 })
    subscriptionBasicPrice: number;

    @Column("decimal", { precision: 10, scale: 2, nullable: true })
    subscriptionBasicPromoPrice: number;

    @Column("int", { default: 30 })
    subscriptionBasicDurationDays: number;

    @UpdateDateColumn()
    updatedAt: Date;
}
