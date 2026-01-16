import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  BaseEntity,
  OneToMany,
  CreateDateColumn,
  BeforeInsert,
} from "typeorm";

import { encriptAdapter } from "../../../config";
import { Pedido } from "./Pedido";
import type { TransaccionMotorizado } from "./TransaccionMotorizado";

// 🔹 Estado administrativo del motorizado
export enum EstadoCuentaMotorizado {
  ACTIVO = "ACTIVO",
  PENDIENTE = "PENDIENTE",
  BLOQUEADO = "BLOQUEADO",
  ELIMINADO = "ELIMINADO",
}

// 🔹 Estado operativo del motorizado
export enum EstadoTrabajoMotorizado {
  DISPONIBLE = "DISPONIBLE",
  EN_EVALUACION = "EN_EVALUACION",
  ENTREGANDO = "ENTREGANDO",
  NO_TRABAJANDO = "NO_TRABAJANDO",
}

@Entity()
export class UserMotorizado extends BaseEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column("varchar", { length: 80 })
  name: string;

  @Column("varchar", { length: 80 })
  surname: string;

  @Column("varchar", { length: 10, unique: true })
  whatsapp: string;

  @Column("varchar", { length: 10, unique: true })
  cedula: string;

  @Column("varchar")
  password: string;

  @Column({ default: 0 })
  tokenVersion!: number;

  @Column("decimal", { precision: 10, scale: 2, default: 0 })
  saldo: number;

  // ==============================
  // 🏦 DATOS BANCARIOS
  // ==============================
  @Column("varchar", { nullable: true })
  bancoNombre: string | null;

  @Column("varchar", { nullable: true })
  bancoTipoCuenta: string | null; // Ahorros, Corriente

  @Column("varchar", { nullable: true })
  bancoNumeroCuenta: string | null;

  @Column("varchar", { nullable: true })
  bancoTitular: string | null;

  @Column("varchar", { nullable: true })
  bancoIdentificacion: string | null; // CI/RUC del titular

  // ==============================
  // 🔐 ESTADO ADMINISTRATIVO
  // ==============================
  @Column("enum", {
    enum: EstadoCuentaMotorizado,
    default: EstadoCuentaMotorizado.PENDIENTE,
  })
  estadoCuenta: EstadoCuentaMotorizado;

  // ==============================
  // 🚦 ESTADO OPERATIVO
  // ==============================
  @Column("enum", {
    enum: EstadoTrabajoMotorizado,
    default: EstadoTrabajoMotorizado.NO_TRABAJANDO,
  })
  estadoTrabajo: EstadoTrabajoMotorizado;

  // ==============================
  // 🧠 INTENCIÓN DEL MOTORIZADO (SWITCH)
  // ==============================
  @Column({ type: "boolean", default: false })
  quiereTrabajar: boolean;

  // ==============================
  // ⏳ CASTIGO PERSISTENTE
  // ==============================
  @Column({ type: "timestamp", nullable: true })
  noDisponibleHasta: Date | null;

  // ==============================
  // ⏱ ORDEN FIFO
  // ==============================
  @Column({ type: "timestamp", nullable: true })
  fechaHoraDisponible: Date | null;

  // ==============================
  // 🔁 OTROS
  // ==============================
  @CreateDateColumn({ type: "timestamp" })
  createdAt: Date;

  @Column("int", { default: 0 })
  resetTokenVersion: number;

  @OneToMany(() => Pedido, (pedido) => pedido.motorizado)
  pedidos: Pedido[];

  @OneToMany("TransaccionMotorizado", (trans: TransaccionMotorizado) => trans.motorizado)
  transacciones: TransaccionMotorizado[];

  @BeforeInsert()
  encryptedPassword() {
    this.password = encriptAdapter.hash(this.password);
  }
}
