import { BaseEntity, Column, Entity, ManyToOne, PrimaryGeneratedColumn, CreateDateColumn, JoinColumn } from "typeorm";
import { Pedido } from "./Pedido";
import { UserMotorizado } from "./UserMotorizado";

@Entity()
export class PedidoOperativoLog extends BaseEntity {
    @PrimaryGeneratedColumn("uuid")
    id: string;

    @Column("uuid")
    pedidoId: string;

    @ManyToOne(() => Pedido)
    @JoinColumn({ name: "pedidoId" })
    pedido: Pedido;

    @Column("uuid", { nullable: true })
    motorizadoId: string;

    @ManyToOne(() => UserMotorizado, { nullable: true })
    @JoinColumn({ name: "motorizadoId" })
    motorizado: UserMotorizado;

    @Column("uuid", { nullable: true })
    adminId: string; // El admin que realizó la acción manual

    @Column("varchar")
    evento: string; // e.g., "PEDIDO_CREADO", "NEGOCIO_ACEPTO", "PROPUESTA_ENVIADA", "MOTORIZADO_ACEPTO", "MOTORIZADO_RECHAZO", "ASIGNADO_MANUAL", "LIBERADO_MANUAL", "CANCELADO_ADMIN"

    @Column("text", { nullable: true })
    detalle: string;

    @CreateDateColumn()
    createdAt: Date;

    static async registrarEvento({
        pedidoId,
        motorizadoId,
        adminId,
        evento,
        detalle
    }: {
        pedidoId: string;
        motorizadoId?: string;
        adminId?: string;
        evento: string;
        detalle?: string;
    }) {
        const log = new PedidoOperativoLog();
        log.pedidoId = pedidoId;
        log.motorizadoId = motorizadoId || null as any;
        log.adminId = adminId || null as any;
        log.evento = evento;
        log.detalle = detalle || null as any;
        await log.save();
        return log;
    }
}
