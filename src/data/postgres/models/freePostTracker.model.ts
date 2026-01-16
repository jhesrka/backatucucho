// ENTIDAD: FreePostTracker
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  UpdateDateColumn,
  BaseEntity,
  OneToMany,
} from "typeorm";
import { Post, User } from "../../index";

@Entity()
export class FreePostTracker extends BaseEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "int", default: 0 })
  count: number; // Posts gratuitos usados este mes

  @Column({ type: "date" })
  monthYear: Date; // Mes/año que se está trackeando (ej: 2023-11-01)

  @ManyToOne(() => User, (user) => user.freePostTrackers)
  user: User;

  @OneToMany(() => Post, (post) => post.freePostTracker)
  posts: Post[];
}
