import {
  BaseEntity,
  Column,
  Entity,
  PrimaryGeneratedColumn,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  Unique,
} from "typeorm";
import { Negocio } from "./Negocio";
import { TipoProducto } from "./TipoProducto";

export enum StatusProducto {
  PENDIENTE = "PENDIENTE",
  ACTIVO = "ACTIVO",
  SUSPENDIDO = "SUSPENDIDO",
  BLOQUEADO = "BLOQUEADO",
}
@Entity()
@Unique(["nombre", "negocio"]) // ✅ El nombre será único solo dentro del mismo negocio
export class Producto extends BaseEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "varchar", length: 100 })
  nombre: string;

  @Column({ type: "text", nullable: true })
  descripcion: string;

  @Column({ type: "varchar", nullable: true })
  imagen: string;

  @Column({ type: "boolean", default: true })
  disponible: boolean;

  @Column({
    type: "enum",
    enum: StatusProducto,
    default: StatusProducto.PENDIENTE,
  })
  statusProducto: StatusProducto;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @ManyToOne(() => Negocio, (negocio) => negocio.productos)
  negocio: Negocio;

  @ManyToOne(() => TipoProducto, (tipo) => tipo.productos, {
    nullable: true,
    onDelete: "SET NULL", // <-- esto es clave
  })
  tipo: TipoProducto | null;

  @Column("decimal", { precision: 10, scale: 2, default: 0 })
  precio_venta: number;

  @Column("decimal", { precision: 10, scale: 2, default: 0 })
  precio_app: number;

  @Column("decimal", { precision: 10, scale: 2, default: 0 })
  comision_producto: number;
}
