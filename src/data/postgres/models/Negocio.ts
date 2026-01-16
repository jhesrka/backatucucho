import {
  BaseEntity,
  Column,
  Entity,
  PrimaryGeneratedColumn,
  ManyToOne,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";

import { CategoriaNegocio } from "./CategoriaNegocio";
import { User } from "./user.model";
import { BalanceNegocio } from "./BalanceNegocio";
import { Producto } from "./Producto";
import { Pedido } from "./Pedido";
import { TipoProducto } from "./TipoProducto";

export enum StatusNegocio {
  PENDIENTE = "PENDIENTE",
  ACTIVO = "ACTIVO",
  SUSPENDIDO = "SUSPENDIDO",
  BLOQUEADO = "BLOQUEADO",
}
export enum ModeloMonetizacion {
  COMISION = "COMISION",
  SUSCRIPCION = "SUSCRIPCION",
}

export enum EstadoNegocio {
  ABIERTO = "ABIERTO",
  CERRADO = "CERRADO",
}

@Entity()
export class Negocio extends BaseEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "varchar", nullable: false, length: 100, unique: true })
  nombre: string;

  @Column({ type: "text", nullable: false })
  descripcion: string;

  @Column({
    type: "varchar",
    nullable: true,
    default: "ImgStore/imagenrota.jpg",
  })
  imagenNegocio: string;

  @Column({
    type: "enum",
    enum: StatusNegocio,
    default: StatusNegocio.PENDIENTE,
  })
  statusNegocio: StatusNegocio;

  @Column({
    type: "enum",
    enum: ModeloMonetizacion,
    nullable: false,
  })
  modeloMonetizacion: ModeloMonetizacion;
  @Column({
    type: "enum",
    enum: EstadoNegocio,
    default: EstadoNegocio.CERRADO,
  })
  estadoNegocio: EstadoNegocio;

  @CreateDateColumn({ type: "timestamp" })
  created_at: Date;

  @Column("decimal", { precision: 10, scale: 6, nullable: true })
  latitud: number | null;

  @Column("decimal", { precision: 10, scale: 6, nullable: true })
  longitud: number | null;

  @Column({ type: "varchar", length: 200, nullable: true })
  direccionTexto: string | null;

  // ==============================
  // 🏦 DATOS BANCARIOS
  // ==============================
  @Column({ type: "varchar", length: 100, nullable: true })
  banco: string | null;

  @Column({ type: "varchar", length: 50, nullable: true })
  tipoCuenta: string | null;

  @Column({ type: "varchar", length: 50, nullable: true })
  numeroCuenta: string | null;

  @Column({ type: "varchar", length: 100, nullable: true })
  titularCuenta: string | null;

  @UpdateDateColumn({ type: "timestamptz" })
  updated_at: Date;

  @ManyToOne(() => User, (user) => user.negocios)
  usuario: User;

  @ManyToOne(() => CategoriaNegocio, (cat) => cat.negocios)
  categoria: CategoriaNegocio;

  @OneToMany(() => Producto, (producto) => producto.negocio, { cascade: true })
  productos: Producto[];
  @OneToMany(() => Pedido, (pedido) => pedido.negocio)
  pedidos: Pedido[];
  @OneToMany(() => TipoProducto, (tipo) => tipo.negocio, { cascade: true })
  tipos: TipoProducto[];

  @OneToMany(() => BalanceNegocio, (balance) => balance.negocio)
  balances: BalanceNegocio[];
}
