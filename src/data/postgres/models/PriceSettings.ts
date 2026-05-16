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

  @Column('decimal', { precision: 10, scale: 2, default: 80.00 })
  motorizadoPercentage: number; // Porcentaje que se lleva el motorizado (ej. 80%)

  @Column('decimal', { precision: 10, scale: 2, default: 20.00 })
  appPercentage: number; // Porcentaje que se lleva la app (ej. 20%)

  @Column('int', { default: 30 })
  storyPurgeDays: number; // Días para purgar historias

  @Column('boolean', { default: false })
  storyAutoPurge: boolean; // ¿Purga automática activada?

  @Column('int', { default: 7 })
  rankingEvaluationPeriodDays: number; // Periodo de evaluación (ej. 7 días)

  @Column('timestamptz', { nullable: true })
  lastRankingUpdate: Date | null; // Fecha del último cierre de ranking

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt: Date;
}
