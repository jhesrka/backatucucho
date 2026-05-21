import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateTrainingCategory1779316725512 implements MigrationInterface {
    name = 'CreateTrainingCategory1779316725512'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "training_categories" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(100) NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_4bf61b3aec2b2abf268eb4850b1" UNIQUE ("name"), CONSTRAINT "PK_35634f5dbbe731ba6ba4be8c0c2" PRIMARY KEY ("id"))`);
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
        await queryRunner.query(`DROP TABLE "training_categories"`);
    }

}
