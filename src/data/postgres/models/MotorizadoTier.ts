import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  BaseEntity,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity()
export class MotorizadoTier extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('varchar', { length: 50 })
  name: string; // Ej: Diamante, Oro, Bronce

  @Column('decimal', { precision: 10, scale: 2 })
  commissionPercentage: number; // Ej: 80.00

  @Column('decimal', { precision: 10, scale: 2 })
  minParticipationPercentage: number; // Ej: 20.00

  @Column('varchar', { length: 20, default: '#admin-primary' })
  color: string; // Para identificarlo en la UI

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
