import { BaseEntity, Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";

@Entity('bank_accounts')
export class BankAccount extends BaseEntity {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column('varchar', { length: 100, name: 'bank_name' })
    bankName: string;

    @Column('varchar', { length: 50, name: 'account_type' })
    accountType: string;

    @Column('varchar', { length: 50, name: 'account_number' })
    accountNumber: string;

    @Column('varchar', { length: 100, name: 'account_holder' })
    accountHolder: string;

    @Column('text', { nullable: true, name: 'qr_image_url' })
    qrImageUrl: string;

    @Column('boolean', { default: true, name: 'is_active' })
    isActive: boolean;

    @Column('int', { default: 0, name: 'order' })
    order: number;

    @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
    createdAt: Date;

    @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
    updatedAt: Date;
}
