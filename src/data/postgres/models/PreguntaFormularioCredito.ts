import {
  BaseEntity,
  Column,
  Entity,
  PrimaryGeneratedColumn,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";
import { Negocio } from "./Negocio";

export type TipoRespuestaCredito = "TEXTO" | "NUMERO" | "OPCION_MULTIPLE" | "SELECCION_MULTIPLE" | "FECHA" | "ARCHIVO";

@Entity()
export class PreguntaFormularioCredito extends BaseEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "varchar", nullable: false, length: 255 })
  pregunta: string;

  @Column({
    type: "varchar",
    length: 50,
    default: "TEXTO",
  })
  tipoRespuesta: TipoRespuestaCredito;

  @Column({ type: "jsonb", nullable: true })
  opciones: string[] | null; // Usado solo si es OPCION_MULTIPLE

  @Column({ type: "boolean", default: true })
  esRequerida: boolean;

  @Column({ type: "int", default: 0 })
  orden: number;

  @ManyToOne(() => Negocio, { onDelete: "CASCADE" })
  negocio: Negocio;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt: Date;
}
