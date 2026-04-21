import {
  BaseEntity,
  Column,
  Entity,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
} from "typeorm";
import { CategoriaNegocio } from "./CategoriaNegocio";
import { Negocio } from "./Negocio";

@Entity()
export class SubcategoriaNegocio extends BaseEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "varchar", nullable: false, length: 100 })
  nombre: string;

  @Column({ type: "int", default: 0 })
  orden: number;

  @CreateDateColumn({ type: "timestamp" })
  created_at: Date;

  @UpdateDateColumn({ type: "timestamp" })
  updated_at: Date;

  @ManyToOne(() => CategoriaNegocio, (categoria) => categoria.subcategorias, {
    onDelete: "CASCADE",
  })
  categoria: CategoriaNegocio;

  @OneToMany(() => Negocio, (negocio) => negocio.subcategoria)
  negocios: Negocio[];
}
