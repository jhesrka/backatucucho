import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, BaseEntity } from 'typeorm';

@Entity('training_categories')
export class TrainingCategory extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100, unique: true })
  name: string;

  @Column({ type: 'simple-array', default: '' })
  allowedRoles: string[];

  @CreateDateColumn()
  createdAt: Date;
}
