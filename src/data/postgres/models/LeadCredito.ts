import { BaseEntity, Column, CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";
import { Negocio } from "./Negocio";
import { User } from "./user.model";

export enum LeadCreditoStatus {
  PENDING = 'PENDING',
  CONTACTED = 'CONTACTED',
  REJECTED = 'REJECTED',
  APPROVED = 'APPROVED'
}

@Entity('lead_credito')
export class LeadCredito extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Negocio, (negocio) => negocio.id, { onDelete: 'CASCADE' })
  negocio: Negocio;

  @ManyToOne(() => User, (user) => user.id, { onDelete: 'CASCADE' })
  usuario: User;

  @Column({ type: 'jsonb', default: {} })
  respuestas: Record<string, string>;

  @Column({ type: 'jsonb', nullable: true })
  preguntas: any[];

  @Column({
    type: 'enum',
    enum: LeadCreditoStatus,
    default: LeadCreditoStatus.PENDING,
  })
  status: LeadCreditoStatus;

  @Column({ type: 'varchar', length: 100, unique: true })
  idempotencyKey: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
