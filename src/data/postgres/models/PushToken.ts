import { BaseEntity, Column, Entity, ManyToOne, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, JoinColumn } from "typeorm";
import { User } from "./user.model";

@Entity()
export class PushToken extends BaseEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column("text", { unique: true })
  token: string;

  @Column("varchar", { length: 50, nullable: true })
  deviceType: string; // 'android', 'ios', 'web'

  @ManyToOne(() => User, (user) => user.pushTokens, { onDelete: "CASCADE" })
  @JoinColumn({ name: "userId" })
  user: User;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
