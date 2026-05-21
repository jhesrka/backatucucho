import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateTrainingVideo1779315117537 implements MigrationInterface {
    name = 'CreateTrainingVideo1779315117537'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user_motorizado" DROP CONSTRAINT "user_motorizado_currentTierId_fkey"`);
        await queryRunner.query(`CREATE TABLE "training_videos" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "title" character varying(255) NOT NULL, "category" character varying(100) NOT NULL, "youtubeUrl" text NOT NULL, "description" text, "priority" integer NOT NULL DEFAULT '0', "isActive" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_567d0937a5abeabe7f75bdc95c9" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "pedido" ALTER COLUMN "costoEnvio" SET DEFAULT '1.25'`);
        await queryRunner.query(`ALTER TABLE "pedido" DROP COLUMN "createdAt"`);
        await queryRunner.query(`ALTER TABLE "pedido" ADD "createdAt" TIMESTAMP NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "pedido" DROP COLUMN "updatedAt"`);
        await queryRunner.query(`ALTER TABLE "pedido" ADD "updatedAt" TIMESTAMP NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "pedido" DROP COLUMN "fechaInicioRonda"`);
        await queryRunner.query(`ALTER TABLE "pedido" ADD "fechaInicioRonda" TIMESTAMP`);
        await queryRunner.query(`ALTER TABLE "pedido" DROP COLUMN "arrival_time"`);
        await queryRunner.query(`ALTER TABLE "pedido" ADD "arrival_time" TIMESTAMP`);
        await queryRunner.query(`ALTER TABLE "motorizado_tier" ALTER COLUMN "color" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "motorizado_tier" ALTER COLUMN "createdAt" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "motorizado_tier" ALTER COLUMN "updatedAt" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "price_settings" ALTER COLUMN "extraDayPrice" SET DEFAULT '0.25'`);
        await queryRunner.query(`ALTER TABLE "price_settings" ALTER COLUMN "rankingEvaluationPeriodDays" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "delivery_settings" ALTER COLUMN "firstRangeFee" SET DEFAULT '1.25'`);
        await queryRunner.query(`ALTER TABLE "delivery_settings" ALTER COLUMN "extraStepFee" SET DEFAULT '0.25'`);
        await queryRunner.query(`ALTER TABLE "global_settings" ALTER COLUMN "acceptedOrderGraceMinutes" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "user_motorizado" ADD CONSTRAINT "FK_4df1a1e971124c5e019686a48fe" FOREIGN KEY ("currentTierId") REFERENCES "motorizado_tier"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user_motorizado" DROP CONSTRAINT "FK_4df1a1e971124c5e019686a48fe"`);
        await queryRunner.query(`ALTER TABLE "global_settings" ALTER COLUMN "acceptedOrderGraceMinutes" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "delivery_settings" ALTER COLUMN "extraStepFee" SET DEFAULT 0.25`);
        await queryRunner.query(`ALTER TABLE "delivery_settings" ALTER COLUMN "firstRangeFee" SET DEFAULT 1.25`);
        await queryRunner.query(`ALTER TABLE "price_settings" ALTER COLUMN "rankingEvaluationPeriodDays" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "price_settings" ALTER COLUMN "extraDayPrice" SET DEFAULT 0.25`);
        await queryRunner.query(`ALTER TABLE "motorizado_tier" ALTER COLUMN "updatedAt" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "motorizado_tier" ALTER COLUMN "createdAt" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "motorizado_tier" ALTER COLUMN "color" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "pedido" DROP COLUMN "arrival_time"`);
        await queryRunner.query(`ALTER TABLE "pedido" ADD "arrival_time" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "pedido" DROP COLUMN "fechaInicioRonda"`);
        await queryRunner.query(`ALTER TABLE "pedido" ADD "fechaInicioRonda" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "pedido" DROP COLUMN "updatedAt"`);
        await queryRunner.query(`ALTER TABLE "pedido" ADD "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "pedido" DROP COLUMN "createdAt"`);
        await queryRunner.query(`ALTER TABLE "pedido" ADD "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "pedido" ALTER COLUMN "costoEnvio" SET DEFAULT 1.25`);
        await queryRunner.query(`DROP TABLE "training_videos"`);
        await queryRunner.query(`ALTER TABLE "user_motorizado" ADD CONSTRAINT "user_motorizado_currentTierId_fkey" FOREIGN KEY ("currentTierId") REFERENCES "motorizado_tier"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

}
