// src/data/models/StoriePriceSettings.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  BaseEntity,
} from 'typeorm';

@Entity()
export class PriceSettings extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('decimal', { precision: 10, scale: 2, default: 1.0 })
  basePrice: number; // Precio por el primer día

  @Column('decimal', { precision: 10, scale: 2, default: 0.25 })
  extraDayPrice: number; // Precio por cada día adicional

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt: Date;
}
