import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    BaseEntity,
    ManyToOne,
    CreateDateColumn,
} from "typeorm";
import type { UserMotorizado } from "./UserMotorizado";
import type { Pedido } from "./Pedido";

export enum TipoTransaccion {
    GANANCIA_ENVIO = "GANANCIA_ENVIO",
    RETIRO = "RETIRO",
    AJUSTE = "AJUSTE",
}

export enum EstadoTransaccion {
    COMPLETADA = "COMPLETADA",
    PENDIENTE = "PENDIENTE",
    RECHAZADA = "RECHAZADA",
}

@Entity()
export class TransaccionMotorizado extends BaseEntity {
    @PrimaryGeneratedColumn("uuid")
    id: string;

    @ManyToOne("UserMotorizado", (user: UserMotorizado) => user.transacciones)
    motorizado: UserMotorizado;

    @ManyToOne("Pedido", { nullable: true })
    pedido: Pedido | null;

    @Column({ type: "enum", enum: TipoTransaccion })
    tipo: TipoTransaccion;

    @Column("decimal", { precision: 10, scale: 2 })
    monto: number;

    @Column("varchar", { nullable: true })
    descripcion: string;

    @CreateDateColumn()
    createdAt: Date;

    @Column({ type: "enum", enum: EstadoTransaccion, default: EstadoTransaccion.COMPLETADA })
    estado: EstadoTransaccion;

    // Snapshot para auditoría
    @Column("decimal", { precision: 10, scale: 2, nullable: true })
    saldoAnterior: number;

    @Column("decimal", { precision: 10, scale: 2, nullable: true })
    saldoNuevo: number;

    // Almacenar detalles extra (ej: banco al momento del retiro)
    @Column("text", { nullable: true })
    detalles: string | null;
}
