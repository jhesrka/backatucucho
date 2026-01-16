import {
  BaseEntity,
  Column,
  Entity,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { User } from "./user.model"; // Importar la entidad User
export enum StatusStorie {
  PUBLISHED = "PUBLISHED", // Publicado y visible
  HIDDEN = "HIDDEN", // Oculto temporalmente (por el usuario o moderador)
  DELETED = "DELETED", // Eliminado (soft delete)
  BANNED = "BANNED", // Bloqueado por infringir normas
}
@Entity()
export class Storie extends BaseEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column("text", {
    nullable: false,
  })
  description: string;

  @Column("varchar", {
    nullable: true,
  })
  imgstorie: string;

  @Column("timestamp", {
    default: () => "CURRENT_TIMESTAMP",
  })
  createdAt: Date;
  @Column("timestamp", {
    default: () => "CURRENT_TIMESTAMP",
  })
  expires_at: Date;
  @Column({ type: "timestamp", nullable: true })
  deletedAt: Date; //

  // ==============================
  // 💰 SNAPSHOT DE PRECIOS
  // ==============================
  @Column("decimal", { precision: 10, scale: 2, default: 0 })
  val_primer_dia: number;

  @Column("decimal", { precision: 10, scale: 2, default: 0 })
  val_dias_adicionales: number;

  @Column("decimal", { precision: 10, scale: 2, default: 0 })
  total_pagado: number;

  @Column("enum", {
    enum: StatusStorie,
    default: StatusStorie.PUBLISHED,
  })
  statusStorie: StatusStorie;

  // Relación de un post con un usuario
  @ManyToOne(() => User, (user) => user.stories) // Un post pertenece a un usuario
  @JoinColumn({ name: "userIdStories" }) // La columna que se usa para la relación
  user: User;
}
