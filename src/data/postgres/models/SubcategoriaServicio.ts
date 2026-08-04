import { Entity, PrimaryGeneratedColumn, Column, BaseEntity, CreateDateColumn, UpdateDateColumn, ManyToOne } from "typeorm";
export enum SubcategoriaStatus {
  ACTIVE = "ACTIVE",
  INACTIVE = "INACTIVE",
  DELETED = "DELETED",
}
import { CategoriaServicio } from "./CategoriaServicio";

@Entity("subcategoria_servicio")
export class SubcategoriaServicio extends BaseEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "varchar", length: 100 })
  nombre: string;

  @Column({ type: "varchar", length: 50, nullable: true })
  icono: string;

  @ManyToOne(() => CategoriaServicio, { onDelete: 'CASCADE' })
  categoria: CategoriaServicio;

  @Column({ type: "enum", enum: SubcategoriaStatus, default: SubcategoriaStatus.ACTIVE })
  estado: SubcategoriaStatus;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt: Date;
}
