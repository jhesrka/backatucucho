// ENTIDAD: Subscription
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  BaseEntity,
} from "typeorm";
import { User } from "../../index";

export enum SubscriptionStatus {
  ACTIVA = "ACTIVA", // Suscripción activa
  EXPIRADA = "EXPIRADA", // Suscripción vencida
  CANCELADA = "CANCELADA", // Cancelada por el usuario o el sistema
  PENDIENTE = "PENDIENTE", // En espera de pago o confirmación
}

export enum SubscriptionPlan {
  BASIC = "basic",
  PREMIUM = "premium",
  BUSINESS = "business",
}

@Entity()
export class Subscription extends BaseEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @ManyToOne(() => User, (user) => user.subscriptions, { onDelete: "CASCADE" })
  user: User;

  @Column({ type: "timestamp" })
  startDate: Date;

  @Column({ type: "timestamp", nullable: true })
  endDate: Date | null; // Añade el tipo union con null

  @Column({
    type: "enum",
    enum: SubscriptionStatus,
    default: SubscriptionStatus.PENDIENTE,
  })
  status: SubscriptionStatus;

  @Column({
    type: "enum",
    enum: SubscriptionPlan,
    nullable: false,
  })
  plan: SubscriptionPlan;

  @Column({ type: "boolean", default: false })
  autoRenewal: boolean;

  @Column({ type: "varchar", nullable: true })
  paymentMethod: string; // 'credit_card', 'paypal', etc.

  @Column({ type: "varchar", nullable: true })
  transactionId: string; // ID de la transacción en el gateway de pago

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Método para verificar si la suscripción está activa
  isActive(): boolean {
    const now = new Date();
    return (
      this.status === SubscriptionStatus.ACTIVA &&
      this.startDate <= now &&
      (this.endDate === null || this.endDate >= now)
    );
  }

  // Método para verificar si la suscripción está expirada
  isExpired(): boolean {
    const now = new Date();
    return this.endDate !== null && this.endDate < now;
  }
}
