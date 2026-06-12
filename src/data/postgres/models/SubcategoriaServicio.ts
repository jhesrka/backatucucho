import { Entity, PrimaryGeneratedColumn, Column, BaseEntity, CreateDateColumn, UpdateDateColumn, ManyToOne } from "typeorm";
import { Status } from "./user.model";
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

  @Column({ type: "enum", enum: Status, default: Status.ACTIVE })
  estado: Status;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt: Date;
}
