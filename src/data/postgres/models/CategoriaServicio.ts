import { Entity, PrimaryGeneratedColumn, Column, BaseEntity, CreateDateColumn, UpdateDateColumn } from "typeorm";
export enum CategoriaStatus {
  ACTIVE = "ACTIVE",
  INACTIVE = "INACTIVE",
  DELETED = "DELETED",
}

@Entity("categoria_servicio")
export class CategoriaServicio extends BaseEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "varchar", length: 100 })
  nombre: string;

  @Column({ type: "varchar", length: 50, nullable: true })
  icono: string;

  @Column({ type: "enum", enum: CategoriaStatus, default: CategoriaStatus.ACTIVE })
  estado: CategoriaStatus;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt: Date;
}
