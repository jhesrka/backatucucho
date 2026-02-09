import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
  BaseEntity,
  JoinColumn, // Added import
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
}

export enum MetodoPago {
  EFECTIVO = "EFECTIVO",
  TRANSFERENCIA = "TRANSFERENCIA",
}

@Entity()
export class Pedido extends BaseEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @ManyToOne(() => User, (user) => user.pedidos)
  cliente: User;

  @ManyToOne(() => Negocio, (negocio) => negocio.pedidos)
  @JoinColumn({ name: "negocioId" }) // Explicitly map to camelCase column verified in DB
  negocio: Negocio;

  // ==============================
  // 🧾 ESTADO DEL PEDIDO
  // ==============================
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

  @Column("decimal", { precision: 10, scale: 2 })
  total: number;

  @Column("decimal", { precision: 10, scale: 2, nullable: true })
  montoVuelto: number | null; // Para pagos en efectivo

  @Column({ type: "text", nullable: true })
  comprobantePagoUrl: string | null; // Para pagos con transferencia

  @Column("decimal", { precision: 10, scale: 2, default: 0 })
  comisionTotal: number; // Snapshot de comision total del pedido

  @Column("decimal", { precision: 10, scale: 2, default: 0 })
  totalNegocio: number; // Lo que le corresponde al negocio (Total - Comision)

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

  // ==============================
  // 🚚 MOTORIZADO ASIGNADO (FINAL)
  // ==============================
  @ManyToOne("UserMotorizado", { nullable: true })
  motorizado: UserMotorizado | null;

  // ==============================
  // 🛒 PRODUCTOS
  // ==============================
  @OneToMany("ProductoPedido", (pp: any) => pp.pedido, { cascade: true })
  productos: ProductoPedido[];

  // ==============================
  // ⏱ FECHAS
  // ==============================
  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // ==============================
  // 📍 DIRECCIÓN
  // ==============================
  @Column("decimal", { precision: 10, scale: 2, nullable: true })
  distanciaKm: number | null;

  @Column("decimal", { precision: 10, scale: 6, nullable: true })
  latCliente: number | null;

  @Column("decimal", { precision: 10, scale: 6, nullable: true })
  lngCliente: number | null;

  @Column({ type: "varchar", nullable: true })
  direccionTexto: string | null;

  // ==============================
  // 🔁 SISTEMA DE RONDAS
  // ==============================
  @Column({ type: "int", default: 1 })
  rondaAsignacion: number;

  @Column({ type: "timestamp", nullable: true })
  fechaInicioRonda: Date | null;

  // 👉 Motorizado al que se le MOSTRÓ el pedido (no asignado aún)
  @Column({ type: "varchar", nullable: true })
  motorizadoEnEvaluacion: string | null;

  // 👉 Bloqueo para evitar doble asignación
  @Column({ type: "boolean", default: false })
  asignacionBloqueada: boolean;

  @Column({ type: "int", default: 0 })
  intentosEnRonda: number;

  @Column({ type: "varchar", nullable: true })
  motivoCancelacion: string | null;
}
