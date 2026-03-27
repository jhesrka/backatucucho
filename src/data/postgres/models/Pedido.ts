import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
  BaseEntity,
  JoinColumn,
  BeforeUpdate,
  BeforeInsert
} from "typeorm";
import { User } from "./user.model";
import { Negocio } from "./Negocio";
import type { UserMotorizado } from "./UserMotorizado";
import type { ProductoPedido } from "./ProductoPedido";

export enum EstadoPedido {
  PENDIENTE = "PENDIENTE",
  ACEPTADO = "ACEPTADO",
  PREPARANDO = "PREPARANDO",
  PREPARANDO_ASIGNADO = "PREPARANDO_ASIGNADO",
  PREPARANDO_NO_ASIGNADO = "PREPARANDO_NO_ASIGNADO",
  EN_CAMINO = "EN_CAMINO",
  ENTREGADO = "ENTREGADO",
  CANCELADO = "CANCELADO",
  PENDIENTE_PAGO = "PENDIENTE_PAGO",
}

export enum MetodoPago {
  EFECTIVO = "EFECTIVO",
  TRANSFERENCIA = "TRANSFERENCIA",
  TARJETA = "TARJETA",
}

export enum EstadoPago {
  PENDIENTE = "PENDIENTE",
  PAGADO = "PAGADO",
  FALLIDO = "FALLIDO",
}

@Entity()
export class Pedido extends BaseEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @ManyToOne(() => User, (user) => user.pedidos)
  cliente: User;

  @ManyToOne(() => Negocio, (negocio) => negocio.pedidos)
  @JoinColumn({ name: "negocioId" })
  negocio: Negocio;

  @Column({
    type: "enum",
    enum: EstadoPedido,
    default: EstadoPedido.PENDIENTE,
  })
  estado: EstadoPedido;

  @Column({
    type: "enum",
    enum: MetodoPago,
    default: MetodoPago.EFECTIVO,
  })
  metodoPago: MetodoPago;

  @Column({
    type: "enum",
    enum: EstadoPago,
    default: EstadoPago.PENDIENTE,
  })
  estadoPago: EstadoPago;

  @Column({ type: "varchar", nullable: true })
  referenciaPago: string | null;

  @Column("decimal", { precision: 10, scale: 2 })
  total: number;

  @Column("decimal", { precision: 10, scale: 2, nullable: true })
  montoVuelto: number | null;

  @Column({ type: "text", nullable: true })
  comprobantePagoUrl: string | null;

  @Column("decimal", { precision: 10, scale: 2, default: 0 })
  comisionTotal: number;

  @Column("decimal", { precision: 10, scale: 2, default: 0 })
  totalNegocio: number;

  @Column("decimal", { precision: 10, scale: 2, default: 1.25 })
  costoEnvio: number;

  @Column("decimal", { precision: 10, scale: 2, default: 80.00 })
  porcentaje_motorizado_aplicado: number;

  @Column("decimal", { precision: 10, scale: 2, default: 20.00 })
  porcentaje_app_aplicado: number;

  @Column("decimal", { precision: 10, scale: 2, default: 0 })
  ganancia_motorizado: number;

  @Column("decimal", { precision: 10, scale: 2, default: 0 })
  comision_app_domicilio: number;

  @Column("decimal", { precision: 10, scale: 2, default: 0 })
  ganancia_app_producto: number;

  @Column("decimal", { precision: 10, scale: 2, default: 0 })
  total_precio_venta_publico: number;

  @Column("decimal", { precision: 10, scale: 2, default: 0 })
  total_precio_app: number;

  @Column("decimal", { precision: 10, scale: 2, default: 0 })
  total_comision_productos: number;

  @Column("decimal", { precision: 10, scale: 2, default: 0 })
  pago_motorizado: number;

  @Column("decimal", { precision: 10, scale: 2, default: 0 })
  comision_moto_app: number;

  @Column("decimal", { precision: 10, scale: 2, default: 0 })
  recargo_tarjeta: number;

  @ManyToOne("UserMotorizado", { nullable: true })
  motorizado: UserMotorizado | null;

  @OneToMany("ProductoPedido", (pp: any) => pp.pedido, { cascade: true })
  productos: ProductoPedido[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column("decimal", { precision: 10, scale: 2, nullable: true })
  distanciaKm: number | null;

  @Column("decimal", { precision: 10, scale: 6, nullable: true })
  latCliente: number | null;

  @Column("decimal", { precision: 10, scale: 6, nullable: true })
  lngCliente: number | null;

  @Column({ type: "varchar", nullable: true })
  direccionTexto: string | null;

  @Column({ type: "int", default: 1 })
  rondaAsignacion: number;

  @Column({ type: "timestamp", nullable: true })
  fechaInicioRonda: Date | null;

  @Column({ type: "varchar", nullable: true })
  motorizadoEnEvaluacion: string | null;

  @Column({ type: "boolean", default: false })
  asignacionBloqueada: boolean;

  @Column({ type: "int", default: 0 })
  intentosEnRonda: number;

  @Column({ type: "timestamptz", nullable: true })
  noAssignedSince: Date | null;

  @Column({ type: "varchar", nullable: true })
  motivoCancelacion: string | null;

  @Column({ type: "boolean", nullable: true, default: null })
  transferenciaCanceladaConfirmada: boolean | null;

  @Column("simple-array", { default: "" })
  motorizadosExcluidos: string[];

  @Column({ type: "varchar", nullable: true })
  pickup_code: string | null;

  @Column({ type: "boolean", default: false })
  pickup_verified: boolean;

  @Column({ type: "varchar", nullable: true })
  delivery_code: string | null;

  @Column({ type: "boolean", default: false })
  delivery_verified: boolean;

  @Column({ type: "timestamp", nullable: true })
  arrival_time: Date | null;

  @Column("decimal", { precision: 2, scale: 1, nullable: true })
  ratingNegocio: number | null;

  @Column("decimal", { precision: 2, scale: 1, nullable: true })
  ratingMotorizado: number | null;

  @BeforeInsert()
  @BeforeUpdate()
  updateNoAssignedSince() {
    if (this.estado === EstadoPedido.PREPARANDO_NO_ASIGNADO) {
      if (!this.noAssignedSince) {
        this.noAssignedSince = new Date();
      }
    } else {
      this.noAssignedSince = null;
    }
  }
}
