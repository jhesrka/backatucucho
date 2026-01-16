import { BaseEntity, Column, Entity, PrimaryGeneratedColumn, ManyToOne, JoinColumn, Unique } from "typeorm";
import { User ,Post } from "../../index";


@Entity()
@Unique(["user", "post"]) // Evita que un mismo usuario dé like al mismo post más de una vez

export class Like extends BaseEntity {
  
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @ManyToOne(() => User, (user) => user.likes, { onDelete: "CASCADE" })
  @JoinColumn({ name: "userId" })
  user: User;

  @ManyToOne(() => Post, { onDelete: "CASCADE" })
  @JoinColumn({ name: "postId" })
  post: Post;

  @Column("timestamp", {
    default: () => "CURRENT_TIMESTAMP",
  })
  createdAt: Date;
}
