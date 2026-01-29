import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn, BaseEntity } from 'typeorm';
import { Wallet, Useradmin } from '../../index';

export type TransactionType = 'credit' | 'debit';

export enum TransactionOrigin {
  SYSTEM = 'SYSTEM',
  ADMIN = 'ADMIN',
  USER = 'USER'
}

export enum TransactionReason {
  RECHARGE = 'RECHARGE',                    // Recarga de saldo
  SUBSCRIPTION = 'SUBSCRIPTION',            // Débito por suscripción
  ADMIN_ADJUSTMENT = 'ADMIN_ADJUSTMENT',    // Ajuste administrativo
  REVERSAL = 'REVERSAL',                    // Reverso/devolución
  ORDER = 'ORDER',                          // Débito por pedido
  REFUND = 'REFUND',                         // Reembolso
  STORIE = 'STORIE',                         // Débito por historia
  WITHDRAWAL = 'WITHDRAWAL'                  // Retiro (Solicitud o Ejecución)
}

@Entity('transactions')
export class Transaction extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Wallet, { onDelete: 'CASCADE' })
  wallet: Wallet;

  @Column('decimal', { precision: 10, scale: 2 })
  amount: number;

  @Column({ type: 'enum', enum: ['credit', 'debit'] })
  type: TransactionType;

  @Column({
    type: 'enum',
    enum: TransactionReason,
    default: TransactionReason.RECHARGE
  })
  reason: TransactionReason;

  @Column({
    type: 'enum',
    enum: TransactionOrigin,
    default: TransactionOrigin.SYSTEM
  })
  origin: TransactionOrigin;

  @Column({
    type: 'varchar', // Simple varchar to avoid enum issues/complexities with migration scripts in this context
    default: 'APPROVED'
  })
  status: string; // 'PENDING' | 'APPROVED' | 'REJECTED'

  @Column('decimal', { precision: 10, scale: 2 })
  previousBalance: number;

  @Column('decimal', { precision: 10, scale: 2 })
  resultingBalance: number;

  @Column({ type: 'varchar', nullable: true })
  reference: string | null; // ID de pedido, suscripción, etc.

  @ManyToOne(() => Useradmin, { nullable: true })
  admin: Useradmin | null; // Admin que realizó la acción

  @Column({ type: 'text', nullable: true })
  observation: string | null; // Nota/motivo adicional

  @CreateDateColumn()
  created_at: Date;
}

