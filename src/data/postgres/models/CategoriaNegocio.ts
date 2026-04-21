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
import { SubcategoriaNegocio } from "./SubcategoriaNegocio";

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

  @Column({ type: "boolean", default: false })
  modeloBloqueado: boolean;

  @Column({
    type: "varchar",
    nullable: true,
    default: null,
  })
  modeloMonetizacionDefault: string | null;

  @Column({ type: "int", default: 0 })
  orden: number;

  @Column({ type: "jsonb", nullable: true, default: null })
  cover: {
    type: "image" | "video";
    imageUrl?: string | null;
    videoUrl?: string | null;
    title?: string | null;
    description?: string | null;
  } | null;

  @CreateDateColumn({ type: "timestamp" })
  created_at: Date;

  @UpdateDateColumn({ type: "timestamp" })
  updated_at: Date;

  @OneToMany(() => Negocio, (negocio) => negocio.categoria)
  negocios: Negocio[];

  @OneToMany(() => SubcategoriaNegocio, (sub) => sub.categoria)
  subcategorias: SubcategoriaNegocio[];
}
