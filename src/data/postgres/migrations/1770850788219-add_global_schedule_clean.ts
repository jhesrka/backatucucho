import { MigrationInterface, QueryRunner } from "typeorm";

export class AddGlobalScheduleClean1770850788219 implements MigrationInterface {
    name = 'AddGlobalScheduleClean1770850788219'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add only the new columns for Global Schedule
        await queryRunner.query(`ALTER TABLE "global_settings" ADD "hora_apertura" TIME NOT NULL DEFAULT '08:00:00'`);
        await queryRunner.query(`ALTER TABLE "global_settings" ADD "hora_cierre" TIME NOT NULL DEFAULT '22:00:00'`);
        await queryRunner.query(`ALTER TABLE "global_settings" ADD "app_status" character varying(10) NOT NULL DEFAULT 'CLOSED'`);
        await queryRunner.query(`ALTER TABLE "global_settings" ADD "modo_operacion" character varying(10) NOT NULL DEFAULT 'AUTO'`);
        await queryRunner.query(`ALTER TABLE "global_settings" ADD "ultimo_cambio_automatico" TIMESTAMP`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "global_settings" DROP COLUMN "ultimo_cambio_automatico"`);
        await queryRunner.query(`ALTER TABLE "global_settings" DROP COLUMN "modo_operacion"`);
        await queryRunner.query(`ALTER TABLE "global_settings" DROP COLUMN "app_status"`);
        await queryRunner.query(`ALTER TABLE "global_settings" DROP COLUMN "hora_cierre"`);
        await queryRunner.query(`ALTER TABLE "global_settings" DROP COLUMN "hora_apertura"`);
    }

}
