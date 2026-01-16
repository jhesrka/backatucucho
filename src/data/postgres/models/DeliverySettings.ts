import {
  BaseEntity, Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn
} from "typeorm";

@Entity()
export class DeliverySettings extends BaseEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  // Hasta cuántos km se cobra el precio base (default 3 km)
  @Column("decimal", { precision: 10, scale: 2, default: 3 })
  firstRangeKm: number;

  // Precio base del primer tramo (default $1.25)
  @Column("decimal", { precision: 10, scale: 2, default: 1.25 })
  firstRangeFee: number;

  // Cada cuántos km adicionales se cobra extra (default 2 km)
  @Column("decimal", { precision: 10, scale: 2, default: 2 })
  extraStepKm: number;

  // Cuánto se cobra por cada tramo adicional (default $0.25)
  @Column("decimal", { precision: 10, scale: 2, default: 0.25 })
  extraStepFee: number;

  @Column({ type: "boolean", default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
