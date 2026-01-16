// src/data/models/wallet.model.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  BaseEntity,
} from 'typeorm';
import { User } from '../../index';

export enum WalletStatus {
  ACTIVO = "ACTIVO",
  BLOQUEADO = "BLOQUEADO",
}
@Entity('wallets')
export class Wallet extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToOne(() => User, user => user.wallet, { eager: false })
  @JoinColumn()
  user: User;

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  balance: number;

 @Column({
    type: "enum",
    enum: WalletStatus,
    default: WalletStatus.ACTIVO,
  })
  status: WalletStatus;

  @CreateDateColumn({ type: "timestamp",name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({type: "timestamp", name: 'updated_at' })
  updated_at: Date;
}
