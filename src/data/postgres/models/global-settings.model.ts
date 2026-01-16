import { BaseEntity, Column, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";

@Entity()
export class GlobalSettings extends BaseEntity {
    @PrimaryGeneratedColumn("uuid")
    id: string;

    @Column("int", { default: 20 })
    orderRetentionDays: number;

    @UpdateDateColumn()
    updatedAt: Date;
}
