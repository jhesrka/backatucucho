import { MigrationInterface, QueryRunner } from "typeorm";

export class AddOrderVerificationFields1773225979278 implements MigrationInterface {
    name = 'AddOrderVerificationFields1773225979278'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "pedido" ADD "pickup_code" character varying`);
        await queryRunner.query(`ALTER TABLE "pedido" ADD "pickup_verified" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "pedido" ADD "delivery_code" character varying`);
        await queryRunner.query(`ALTER TABLE "pedido" ADD "delivery_verified" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "pedido" ADD "arrival_time" TIMESTAMP`);
        await queryRunner.query(`ALTER TABLE "global_settings" ADD "driver_cancel_wait_time" integer NOT NULL DEFAULT 10`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "global_settings" DROP COLUMN "driver_cancel_wait_time"`);
        await queryRunner.query(`ALTER TABLE "pedido" DROP COLUMN "arrival_time"`);
        await queryRunner.query(`ALTER TABLE "pedido" DROP COLUMN "delivery_verified"`);
        await queryRunner.query(`ALTER TABLE "pedido" DROP COLUMN "delivery_code"`);
        await queryRunner.query(`ALTER TABLE "pedido" DROP COLUMN "pickup_verified"`);
        await queryRunner.query(`ALTER TABLE "pedido" DROP COLUMN "pickup_code"`);
    }

}
