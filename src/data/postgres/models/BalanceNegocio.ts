import { BaseEntity, Column, Entity, ManyToOne, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from "typeorm";
import { Negocio } from "./Negocio";

export enum EstadoBalance {
    PENDIENTE = "PENDIENTE", // Hay deuda y no se ha pagado (o no se ha reclamado)
    PAGADO = "PAGADO",       // Se subió comprobante (o app pagó) y espera confirmación
    LIQUIDADO = "LIQUIDADO"  // Confirmado y cerrado
}

@Entity()
export class BalanceNegocio extends BaseEntity {
    @PrimaryGeneratedColumn("uuid")
    id: string;

    @Column("date")
    fecha: Date; // Fecha del reporte (YYYY-MM-DD)

    @Column("decimal", { precision: 10, scale: 2, default: 0 })
    totalVendido: number; // Solo productos

    @Column("decimal", { precision: 10, scale: 2, default: 0 })
    totalComision: number; // App's share

    @Column("decimal", { precision: 10, scale: 2, default: 0 })
    totalDelivery: number;

    // Totales por método de pago (para cálculo de deuda)
    @Column("decimal", { precision: 10, scale: 2, default: 0 })
    totalEfectivo: number; // Cash received by business

    @Column("decimal", { precision: 10, scale: 2, default: 0 })
    totalTransferencia: number; // Transfer received by App

    @Column("decimal", { precision: 10, scale: 2, default: 0 })
    balanceFinal: number; // Positivo: App debe a Negocio. Negativo: Negocio debe a App.

    @Column({
        type: "enum",
        enum: EstadoBalance,
        default: EstadoBalance.PENDIENTE
    })
    estado: EstadoBalance;

    @Column("text", { nullable: true })
    comprobanteUrl: string; // URL de la foto del pago

    @ManyToOne(() => Negocio, (negocio) => negocio.balances)
    negocio: Negocio;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
