import { BaseEntity, Column, Entity, ManyToOne, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, JoinColumn } from "typeorm";
import { User } from "./user.model";
import { UserMotorizado } from "./UserMotorizado";
import { Useradmin } from "./useradmin.model";

@Entity()
export class PushToken extends BaseEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column("text", { unique: true })
  token: string;

  @Column("varchar", { length: 50, nullable: true })
  deviceType: string; // 'android', 'ios', 'web'

  @ManyToOne(() => User, (user) => user.pushTokens, { onDelete: "CASCADE", nullable: true })
  @JoinColumn({ name: "userId" })
  user: User;

  @ManyToOne(() => UserMotorizado, { onDelete: "CASCADE", nullable: true })
  @JoinColumn({ name: "motorizadoId" })
  motorizado: UserMotorizado;

  @ManyToOne(() => Useradmin, { onDelete: "CASCADE", nullable: true })
  @JoinColumn({ name: "adminId" })
  admin: Useradmin;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
