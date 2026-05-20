import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  BaseEntity,
} from 'typeorm';

@Entity()
export class MeritocracyCycleLog extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('timestamptz')
  cycleStart: Date;

  @Column('timestamptz')
  cycleEnd: Date;

  @Column('varchar', { length: 20 })
  executionType: 'AUTO' | 'MANUAL';

  @Column('varchar', { length: 20 })
  status: 'SUCCESS' | 'FAILED';

  @Column('text', { nullable: true })
  errorMessage: string | null;

  @Column('int', { default: 0 })
  processedMotorizadosCount: number;

  @Column('int', { default: 0 })
  totalOrdersCount: number;

  @CreateDateColumn({ type: 'timestamptz' })
  executedAt: Date;
}
