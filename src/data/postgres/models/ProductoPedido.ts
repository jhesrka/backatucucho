import {
  Entity,
  PrimaryGeneratedColumn,
  ManyToOne,
  Column,
  BaseEntity,
} from "typeorm";
import { Pedido } from "./Pedido";
import { Producto } from "./Producto";


@Entity()
export class ProductoPedido extends BaseEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @ManyToOne(() => Pedido, (pedido) => pedido.productos, { onDelete: "CASCADE" })
  pedido: Pedido;

  @ManyToOne(() => Producto)
  producto: Producto;

  @Column("int")
  cantidad: number;

  @Column("decimal", { precision: 10, scale: 2 })
  subtotal: number; // cantidad * precio_app

  @Column("decimal", { precision: 10, scale: 2, default: 0 })
  precio_venta: number;

  @Column("decimal", { precision: 10, scale: 2, default: 0 })
  precio_app: number;

  @Column("decimal", { precision: 10, scale: 2, default: 0 })
  comision_producto: number;
}

