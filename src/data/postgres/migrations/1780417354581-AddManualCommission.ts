import { MigrationInterface, QueryRunner } from "typeorm";

export class AddManualCommission1780417354581 implements MigrationInterface {
    name = 'AddManualCommission1780417354581'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user_motorizado" ADD "isManualCommission" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "user_motorizado" ADD "manualCommissionPercentage" numeric(10,2)`);
        await queryRunner.query(`ALTER TABLE "pedido" ALTER COLUMN "costoEnvio" SET DEFAULT '1.25'`);
        await queryRunner.query(`ALTER TABLE "price_settings" ALTER COLUMN "extraDayPrice" SET DEFAULT '0.25'`);
        await queryRunner.query(`ALTER TABLE "delivery_settings" ALTER COLUMN "firstRangeFee" SET DEFAULT '1.25'`);
        await queryRunner.query(`ALTER TABLE "delivery_settings" ALTER COLUMN "extraStepFee" SET DEFAULT '0.25'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "delivery_settings" ALTER COLUMN "extraStepFee" SET DEFAULT 0.25`);
        await queryRunner.query(`ALTER TABLE "delivery_settings" ALTER COLUMN "firstRangeFee" SET DEFAULT 1.25`);
        await queryRunner.query(`ALTER TABLE "price_settings" ALTER COLUMN "extraDayPrice" SET DEFAULT 0.25`);
        await queryRunner.query(`ALTER TABLE "pedido" ALTER COLUMN "costoEnvio" SET DEFAULT 1.25`);
        await queryRunner.query(`ALTER TABLE "user_motorizado" DROP COLUMN "manualCommissionPercentage"`);
        await queryRunner.query(`ALTER TABLE "user_motorizado" DROP COLUMN "isManualCommission"`);
    }

}
