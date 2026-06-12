import { Entity, PrimaryGeneratedColumn, Column, BaseEntity, CreateDateColumn, UpdateDateColumn, ManyToOne } from "typeorm";
import { User } from "./user.model";
import { CategoriaServicio } from "./CategoriaServicio";
import { SubcategoriaServicio } from "./SubcategoriaServicio";

export enum StatusServicio {
  PENDIENTE = "PENDIENTE",
  APROBADO = "APROBADO",
  RECHAZADO = "RECHAZADO",
  EXPIRADO = "EXPIRADO",
  NO_PAGADO = "NO_PAGADO",
}

@Entity("servicio")
export class Servicio extends BaseEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  user: User;

  @ManyToOne(() => CategoriaServicio)
  categoria: CategoriaServicio;

  @ManyToOne(() => SubcategoriaServicio)
  subcategoria: SubcategoriaServicio;

  @Column({ type: "varchar", length: 100 })
  nombres: string;

  @Column({ type: "varchar", length: 100 })
  apellidos: string;

  @Column({ type: "varchar", length: 50 })
  whatsapp: string;

  @Column({ type: "text", nullable: true })
  descripcion: string;

  @Column({ type: "text", nullable: true })
  imagenServicio: string;

  @Column({ type: "text", nullable: true })
  videoUrl: string;

  @Column({ type: "enum", enum: StatusServicio, default: StatusServicio.PENDIENTE })
  statusServicio: StatusServicio;

  @Column({ type: "timestamptz", nullable: true })
  fechaInicioSuscripcion: Date;

  @Column({ type: "timestamptz", nullable: true })
  fechaFinSuscripcion: Date;

  @Column({ type: "boolean", default: true })
  autorenovacion: boolean;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt: Date;
}
