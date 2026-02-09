import { BaseEntity, Column, Entity, ManyToOne, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from "typeorm";
import { Negocio } from "./Negocio";
import { Useradmin } from "./useradmin.model";

export enum EstadoBalance {
    PENDIENTE = "PENDIENTE",
    PAGADO = "PAGADO",
    LIQUIDADO = "LIQUIDADO"
}

@Entity()
export class BalanceNegocio extends BaseEntity {
    @PrimaryGeneratedColumn("uuid")
    id: string;

    @Column("date")
    fecha: string; // Changed to string to match FinancialClosing and ensure YYYY-MM-DD consistency

    @Column("decimal", { precision: 10, scale: 2, default: 0 })
    totalVendido: number; // Ventas Totales (Precio Cliente)

    @Column("decimal", { precision: 10, scale: 2, default: 0 })
    totalComision: number; // Comisión por productos

    @Column("decimal", { precision: 10, scale: 2, default: 0 })
    totalDelivery: number; // Comisión por domicilio (envío)

    @Column("decimal", { precision: 10, scale: 2, default: 0 })
    totalComisionApp: number; // App's cut (total_comision_productos + costoEnvio)

    @Column("decimal", { precision: 10, scale: 2, default: 0 })
    totalEfectivo: number; // Cash received by motorizado (App has it)

    @Column("decimal", { precision: 10, scale: 2, default: 0 })
    totalTransferencia: number; // Transfer received by local (Shop has it)

    @Column("decimal", { precision: 10, scale: 2, default: 0 })
    balanceFinal: number; // Positivo: El local debe pagar a la APP. Negativo: La APP debe pagar al local.

    @Column({
        type: "enum",
        enum: EstadoBalance,
        default: EstadoBalance.PENDIENTE
    })
    estado: EstadoBalance;

    @Column("text", { nullable: true })
    comprobanteUrl: string;

    @Column({ type: "boolean", default: false })
    isClosed: boolean;

    @ManyToOne(() => Useradmin, { nullable: true })
    closedBy: Useradmin;

    @ManyToOne(() => Negocio, (negocio) => negocio.balances)
    negocio: Negocio;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
