// ENTIDAD: RechargeRequest
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  BaseEntity,
} from "typeorm";
import { User } from "./user.model";

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

  @Column("decimal", { precision: 10, scale: 2, nullable: true })
  amount: number | null;

  @Column("varchar", {
    nullable: true,
  })
  bank_name: string | null;

  @Column("date", {
    nullable: true,
  })
  transaction_date: Date | null;

  @Column("varchar", {
    nullable: true,
    // unique: true  <-- Removed to use Composite Unique Index instead
  })
  receipt_number: string | null;

  @Column({ default: false })
  isDuplicateWarning: boolean;

  @Column({ default: false })
  requiresManualReview: boolean;

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

  @Column("timestamp", { nullable: true })
  resolved_at: Date;
}
