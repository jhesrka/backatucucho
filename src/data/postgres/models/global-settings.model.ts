import { BaseEntity, Column, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";

@Entity()
export class GlobalSettings extends BaseEntity {
    @PrimaryGeneratedColumn("uuid")
    id: string;

    @Column("int", { default: 20 })
    orderRetentionDays: number;

    @Column("varchar", { length: 60, nullable: true })
    masterPin?: string; // PIN de 4 dígitos hasheado con bcrypt (60 caracteres)

    @UpdateDateColumn()
    updatedAt: Date;
}
