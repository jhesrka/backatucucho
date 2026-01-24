import { BaseEntity, Column, CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { Useradmin } from "../useradmin.model";

@Entity('financial_closings')
export class FinancialClosing extends BaseEntity {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'date', unique: true })
    closingDate: string; // Fecha del cierre (YYYY-MM-DD)

    @Column('decimal', { precision: 10, scale: 2 })
    totalIncome: number; // Total Ingresos Sistema

    @Column('decimal', { precision: 10, scale: 2 })
    totalExpenses: number; // Total Egresos (Informativo)

    @Column('varchar')
    backupFileUrl: string; // URL del archivo de respaldo S3

    @Column('int')
    totalRechargesCount: number;

    @ManyToOne(() => Useradmin)
    closedBy: Useradmin;

    @CreateDateColumn()
    createdAt: Date;
}
