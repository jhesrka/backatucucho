import {
  BaseEntity,
  Column,
  Entity,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  BeforeInsert,
} from "typeorm";
import { encriptAdapter } from "../../../config";

export enum Statusadmin {
  ACTIVE = "ACTIVE",
  INACTIVE = "INACTIVE",
  DELETED = "DELETED",
}
export enum UserRoleAdmin {
  ADMIN = "ADMIN",
  ASISTENTE = "ASISTENTE",
}
@Entity()
export class Useradmin extends BaseEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column("varchar", {
    length: 80,
    nullable: false,
  })
  username: string;

  @Column("varchar", {
    length: 80,
    nullable: false,
  })
  name: string;

  @Column("varchar", {
    length: 80,
    nullable: false,
  })
  surname: string;

  @Column("varchar", {
    length: 80,
    nullable: false,
    unique: true,
  })
  email: string;

  @Column("varchar", {
    nullable: false,
  })
  password: string;

  @Column("varchar", {
    length: 10,
    nullable: false,
    unique: true,
  })
  whatsapp: string;

  @CreateDateColumn({
    type: "timestamp",
    
  })
  created_at: Date;

  @UpdateDateColumn({
    type: "timestamp",
    onUpdate: "CURRENT_TIMESTAMP",
  })
  updated_at: Date;

  @Column("enum", {
    enum: UserRoleAdmin,
  })
  rol: UserRoleAdmin;

  @Column("enum", {
    enum: Statusadmin,
    default: Statusadmin.ACTIVE,
  })
  status: Statusadmin;
  
  @Column("int", { default: 0 })
  resetTokenVersion: number;

  @BeforeInsert()
  encryptedPassword() {
    this.password = encriptAdapter.hash(this.password);
  }
}
