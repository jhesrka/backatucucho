import {
  BaseEntity,
  Column,
  Entity,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
  CreateDateColumn,
} from "typeorm";
import { FreePostTracker, Like, User } from "../../index";
export enum StatusPost {
  PUBLICADO = "PUBLICADO", // Publicado y visible para todos
  OCULTO = "OCULTO", // Oculto temporalmente por el usuario o un moderador
  ELIMINADO = "ELIMINADO", // Eliminado (eliminación lógica o "soft delete")
  BLOQUEADO = "BLOQUEADO", // Bloqueado por incumplir las normas de la plataforma
}

@Entity()
export class Post extends BaseEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column("text", {
    nullable: false,
  })
  content: string;

  @Column("varchar", {
    array: true,
    nullable: true,
  })
  imgpost: string[];

  @Column("varchar", {
    length: 30,
    nullable: false,
  })
  title: string;

  @Column("varchar", {
    length: 30,
    nullable: false,
  })
  subtitle: string;

  @Column({ default: true })
  isPaid: boolean; // true = pago, false = gratis

  @CreateDateColumn({ type: 'timestamp' }) // <-- Esto soluciona el problema
    createdAt: Date;

  @Column({ type: "timestamp", nullable: true })
  expiresAt: Date; // Fecha de expiración (solo para posts gratis)

  @Column({ type: "timestamp", nullable: true })
  deletedAt: Date; // Para soft delete

  @Column("enum", {
    enum: StatusPost,
    default: StatusPost.PUBLICADO,
  })
  statusPost: StatusPost;
  @Column({ type: "int", default: 0 })
  likesCount: number;

  @Column({ type: "uuid", nullable: true })
  freePostTrackerId: string; // Relación con el contador mensual

  // Relación de un post con un usuario
  @ManyToOne(() => User, (user) => user.posts, {
    eager: false,
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "userId" }) // La columna que se usa para la relación
  user: User;

  @ManyToOne(() => FreePostTracker, (tracker) => tracker.posts, {
    onDelete: "SET NULL",
    nullable: true,
  })
  @JoinColumn({ name: "freePostTrackerId" })
  freePostTracker: FreePostTracker;
}
