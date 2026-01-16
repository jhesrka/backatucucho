// ENTIDAD: RechargeRequest
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  BaseEntity,
} from "typeorm";
import { User } from "../../index";

export enum StatusRecarga {
  PENDIENTE = "PENDIENTE",
  APROBADO = "APROBADO",
  RECHAZADO = "RECHAZADO",
}
//"pending" | "approved" | "rejected";

@Entity("recharge_requests")
export class RechargeRequest extends BaseEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @ManyToOne(() => User, (user) => user.rechargeRequests)
  user: User;

  @Column("decimal", { precision: 10, scale: 2 })
  amount: number;

  @Column("varchar", {
    nullable: false,
  })
  bank_name: string;

  @Column({
    nullable: false,
  })
  transaction_date: Date;

  @Column("varchar", {
    nullable: false,
    unique: true,
  })
  receipt_number: string;

  @Column("varchar", {
    nullable: false,
  })
  receipt_image: string;

  @Column("enum", {
    enum: StatusRecarga,
    default: StatusRecarga.PENDIENTE,
  })
  status: StatusRecarga;

  @Column({
    nullable: true,
  })
  admin_comment: string;

  @CreateDateColumn({ type: "timestamp" })
  created_at: Date;

  @Column({ nullable: true })
  resolved_at: Date;
}
