import {
  BaseEntity,
  Column,
  Entity,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from "typeorm";
import { Negocio } from "./Negocio";

export enum StatusCategoria {
  ACTIVO = "ACTIVO",
  SUSPENDIDO = "SUSPENDIDO",
}
export enum RestriccionModeloMonetizacion {
  COMISION_SUSCRIPCION = "COMISION_SUSCRIPCION",
  SUSCRIPCION = "SUSCRIPCION",
}
@Entity()
export class CategoriaNegocio extends BaseEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "varchar", nullable: false, length: 100, unique: true })
  nombre: string;

  @Column({ type: "varchar", nullable: false })
  icono: string;

  @Column({
    type: "enum",
    enum: StatusCategoria,
    default: StatusCategoria.ACTIVO,
  })
  statusCategoria: StatusCategoria;
  @Column({
    type: "enum",
    enum: RestriccionModeloMonetizacion,
    nullable: true,
    default: null,
  })
  restriccionModeloMonetizacion?: RestriccionModeloMonetizacion | null;

  @Column({ type: "boolean", default: false })
  soloComision: boolean;

  @CreateDateColumn({ type: "timestamp" })
  created_at: Date;

  @UpdateDateColumn({ type: "timestamp" })
  updated_at: Date;

  @OneToMany(() => Negocio, (negocio) => negocio.categoria)
  negocios: Negocio[];
}
