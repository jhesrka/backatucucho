import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    BaseEntity,
    ManyToOne,
    CreateDateColumn,
    JoinColumn,
} from "typeorm";
import { UserMotorizado } from "./UserMotorizado";
import { Pedido } from "./Pedido";
import { Useradmin } from "./useradmin.model";

export enum WalletMovementType {
    GANANCIA_ENVIO = "GANANCIA_ENVIO",
    RETIRO_SOLICITADO = "RETIRO_SOLICITADO",
    RETIRO_APROBADO = "RETIRO_APROBADO",
    AJUSTE_ADMIN = "AJUSTE_ADMIN",
    DEVOLUCION_RETIRO = "DEVOLUCION_RETIRO",
}

export enum WalletMovementStatus {
    PENDIENTE = "PENDIENTE",
    COMPLETADO = "COMPLETADO",
    PROCESADO = "PROCESADO",
    CANCELADO = "CANCELADO",
}

@Entity({ name: "wallet_movements" })
export class WalletMovement extends BaseEntity {
    @PrimaryGeneratedColumn("uuid")
    id: string;

    @Column({ name: "motorized_id" })
    motorizedId: string;

    @ManyToOne(() => UserMotorizado)
    @JoinColumn({ name: "motorized_id" })
    motorizado: UserMotorizado;

    @Column({
        type: "enum",
        enum: WalletMovementType,
    })
    type: WalletMovementType;

    @Column("decimal", { precision: 10, scale: 2 })
    amount: number;

    @Column("decimal", { name: "balance_after", precision: 10, scale: 2, default: 0 })
    balanceAfter: number;

    @Column({
        type: "enum",
        enum: WalletMovementStatus,
        default: WalletMovementStatus.COMPLETADO,
    })
    status: WalletMovementStatus;

    @Column("varchar", { nullable: true })
    description: string;

    @Column("varchar", { name: "reference_id", nullable: true })
    referenceId: string | null;

    @Column({ name: "order_id", nullable: true })
    orderId: string | null;

    @ManyToOne(() => Pedido, { nullable: true, onDelete: "SET NULL" })
    @JoinColumn({ name: "order_id" })
    pedido: Pedido | null;

    @Column({ name: "admin_id", nullable: true })
    adminId: string | null;

    @ManyToOne(() => Useradmin, { nullable: true })
    @JoinColumn({ name: "admin_id" })
    admin: Useradmin | null;

    @CreateDateColumn({ name: "created_at" })
    createdAt: Date;
}
