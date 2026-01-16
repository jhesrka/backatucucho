import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn } from 'typeorm';
import { Wallet } from '../../index';


export type TransactionType = 'credit' | 'debit';

@Entity('transactions')
export class Transaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Wallet)
  wallet: Wallet;

  @Column('decimal', { precision: 10, scale: 2 })
  amount: number;

  @Column({ type: 'enum', enum: ['credit', 'debit'] })
  type: TransactionType;

  @Column()
  reason: string;

  @CreateDateColumn()
  created_at: Date;
}
