import { BaseEntity, Column, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";

@Entity()
export class GlobalSettings extends BaseEntity {
    @PrimaryGeneratedColumn("uuid")
    id: string;

    @Column("int", { default: 20 })
    orderRetentionDays: number;

    @Column("int", { default: 60 })
    rechargeRetentionDays: number; // Días de retención para recargas

    @Column("int", { default: 30 })
    reportsRetentionDays: number; // Purga de reportes

    @Column("int", { default: 60 })
    cleanupSubscriptionContentDays: number; // Días para eliminar contenido de suscripciones vencidas

    // ==========================================
    // 🕒 HORARIOS Y ESTADO GLOBAL DE LA APP
    // ==========================================

    @Column("time", { default: "08:00:00" })
    hora_apertura: string;

    @Column("time", { default: "22:00:00" })
    hora_cierre: string;

    @Column("varchar", { length: 10, default: "CLOSED" })
    app_status: "OPEN" | "CLOSED";

    @Column("varchar", { length: 10, default: "AUTO" })
    modo_operacion: "AUTO" | "MANUAL";

    @Column("timestamp", { nullable: true })
    ultimo_cambio_automatico: Date;


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

    @Column("varchar", { length: 20, default: "v1.0" })
    currentTermsVersion: string;

    @Column("timestamp", { default: () => "CURRENT_TIMESTAMP" })
    termsUpdatedAt: Date;

    @Column("int", { default: 60000 })
    timeoutRondaMs: number;

    @Column("int", { default: 4 })
    maxRondasAsignacion: number;

    @Column("int", { default: 10 })
    driver_cancel_wait_time: number;

    @Column("int", { default: 10 })
    max_wait_time_acceptance: number; // Tiempo máximo para aceptar pedidos (minutos)

    // Payphone Platform Credentials (for Recharges)
    @Column("text", { nullable: true })
    payphoneToken?: string;

    @Column("varchar", { length: 100, nullable: true })
    payphoneStoreId?: string;

    @Column("decimal", { precision: 5, scale: 2, default: 0.00 })
    payphoneRechargePercentage: number;

    @Column("jsonb", { nullable: true })
    businessCover: {
        type: "image" | "video";
        imageUrl?: string;
        videoUrl?: string;
        title?: string;
        description?: string;
    };

    @UpdateDateColumn()
    updatedAt: Date;
}
