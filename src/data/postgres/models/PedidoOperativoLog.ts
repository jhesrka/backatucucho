import { BaseEntity, Column, Entity, ManyToOne, PrimaryGeneratedColumn, CreateDateColumn, JoinColumn } from "typeorm";
// Entity for forensic order traceability logs
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
    adminId: string; 

    @Column("varchar", { nullable: true })
    actorTipo: 'SISTEMA' | 'CLIENTE' | 'NEGOCIO' | 'MOTORIZADO' | 'ADMIN';

    @Column("uuid", { nullable: true })
    actorId: string;

    @Column("varchar", { nullable: true })
    estadoAnterior: string;

    @Column("varchar", { nullable: true })
    estadoNuevo: string;

    @Column("varchar")
    evento: string; 

    @Column("text", { nullable: true })
    detalle: string;

    @CreateDateColumn()
    createdAt: Date;

    static async registrarEvento({
        pedidoId,
        motorizadoId,
        adminId,
        actorTipo = 'SISTEMA',
        actorId,
        estadoAnterior,
        estadoNuevo,
        evento,
        detalle
    }: {
        pedidoId: string;
        motorizadoId?: string;
        adminId?: string;
        actorTipo?: 'SISTEMA' | 'CLIENTE' | 'NEGOCIO' | 'MOTORIZADO' | 'ADMIN';
        actorId?: string;
        estadoAnterior?: string;
        estadoNuevo?: string;
        evento: string;
        detalle?: string;
    }) {
        const log = new PedidoOperativoLog();
        log.pedidoId = pedidoId;
        log.motorizadoId = motorizadoId || null as any;
        log.adminId = adminId || null as any;
        log.actorTipo = actorTipo;
        log.actorId = actorId || null as any;
        log.estadoAnterior = estadoAnterior || null as any;
        log.estadoNuevo = estadoNuevo || null as any;
        log.evento = evento;
        log.detalle = detalle || null as any;
        await log.save();
        return log;
    }
}
