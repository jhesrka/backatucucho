// src/data/entities/TipoProducto.ts
import {
  BaseEntity,
  Column,
  Entity,
  PrimaryGeneratedColumn,
  OneToMany,
  ManyToOne,
} from "typeorm";
import { Producto } from "./Producto";
import { Negocio } from "./Negocio";

@Entity()
export class TipoProducto extends BaseEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  // 👇 SIN unique
  @Column({ type: "varchar", length: 50 })
  nombre: string;

  // 👇 Cada tipo pertenece a un negocio
  @ManyToOne(() => Negocio, (negocio) => negocio.tipos, {
    onDelete: "CASCADE",
    nullable: false,
  })
  negocio: Negocio;

  @OneToMany(() => Producto, (producto) => producto.tipo)
  productos: Producto[];
}
