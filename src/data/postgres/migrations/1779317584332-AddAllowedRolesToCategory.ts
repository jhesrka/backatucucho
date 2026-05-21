import { MigrationInterface, QueryRunner } from "typeorm";

export class AddAllowedRolesToCategory1779317584332 implements MigrationInterface {
    name = 'AddAllowedRolesToCategory1779317584332'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "training_categories" ADD "allowedRoles" text NOT NULL DEFAULT ''`);
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
        await queryRunner.query(`ALTER TABLE "training_categories" DROP COLUMN "allowedRoles"`);
    }

}
