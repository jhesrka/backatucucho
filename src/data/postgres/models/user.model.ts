import {
  BaseEntity,
  Column,
  Entity,
  PrimaryGeneratedColumn,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
  BeforeInsert,
  OneToOne,
} from "typeorm";
import { encriptAdapter } from "../../../config";
import {
  Storie,
  Post,
  Like,
  Wallet,
  Subscription,
  RechargeRequest,
  FreePostTracker,
} from "../../index";
import { Negocio } from "./Negocio";
import { Pedido } from "./Pedido";

export enum Status {
  ACTIVE = "ACTIVE",
  INACTIVE = "INACTIVE",
  DELETED = "DELETED",
  BANNED = "BANNED",
}

export enum UserRole {
  ADMIN = "ADMIN",
  USER = "USER",
}
@Entity()
export class User extends BaseEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column("varchar", {
    length: 100,
    nullable: true,
    unique: true,
  })
  googleId: string;

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
    nullable: true,
  })
  password: string;


  @Column("date", {
    nullable: false,
  })
  birthday: Date;

  @Column("varchar", {
    nullable: true,
    default: "ImgStore/user.png",
  })
  photoperfil: string;

  @Column("varchar", {
    length: 15,
    nullable: true,
    unique: true,
  })
  whatsapp: string;

  @CreateDateColumn({ type: "timestamp" })
  createdAt: Date;

  @CreateDateColumn({ type: "timestamp" })
  updated_at: Date;

  @Column("enum", {
    enum: UserRole,
    default: UserRole.USER,
  })
  rol: UserRole;

  @Column("enum", {
    enum: Status,
    default: Status.INACTIVE,
  })
  status: Status;

  @Column("int", { default: 0 })
  resetTokenVersion: number;

  // Sesión Única y Seguridad
  @Column("boolean", { default: false })
  isLoggedIn: boolean;

  @Column("varchar", { nullable: true })
  currentSessionId: string;

  @Column("varchar", { nullable: true })
  lastLoginIP: string;

  @Column("varchar", { nullable: true })
  lastLoginCountry: string;

  @Column("timestamp", { nullable: true })
  lastLoginDate: Date;

  @Column("varchar", { nullable: true })
  lastDeviceInfo: string;

  // Relación de un usuario con muchos posts
  @OneToMany(() => Post, (post) => post.user)
  posts: Post[]; // Un usuario tiene muchos posts
  @OneToMany(() => Storie, (storie) => storie.user)
  stories: Storie[];
  @OneToMany(() => Like, (like) => like.user)
  likes: Like[];
  @OneToOne(() => Wallet, (wallet) => wallet.user, { cascade: true })
  wallet: Wallet;
  @OneToMany(() => Subscription, (sub) => sub.user)
  subscriptions: Subscription[];
  @OneToMany(() => RechargeRequest, (req) => req.user)
  rechargeRequests: RechargeRequest[];
  @OneToMany(() => FreePostTracker, (tracker) => tracker.user)
  freePostTrackers: FreePostTracker[];
  @OneToMany(() => Negocio, (negocio) => negocio.usuario)
  negocios: Negocio[];
  @OneToMany(() => Pedido, (pedido) => pedido.cliente)
  pedidos: Pedido[];

  @BeforeInsert()
  encryptedPassword() {
    if (this.password) {
      this.password = encriptAdapter.hash(this.password);
    }
  }
}
