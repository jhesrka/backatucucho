import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    BaseEntity,
    ManyToOne,
} from "typeorm";
import { Useradmin } from "./useradmin.model";

@Entity()
export class CommissionLog extends BaseEntity {
    @PrimaryGeneratedColumn("uuid")
    id: string;

    @Column("decimal", { precision: 10, scale: 2 })
    prevMotorizadoPercentage: number;

    @Column("decimal", { precision: 10, scale: 2 })
    newMotorizadoPercentage: number;

    @Column("decimal", { precision: 10, scale: 2 })
    prevAppPercentage: number;

    @Column("decimal", { precision: 10, scale: 2 })
    newAppPercentage: number;

    @ManyToOne(() => Useradmin)
    changedBy: Useradmin;

    @CreateDateColumn({ type: "timestamp" })
    createdAt: Date;
}
