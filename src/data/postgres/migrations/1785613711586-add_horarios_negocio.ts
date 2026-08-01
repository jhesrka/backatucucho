import { MigrationInterface, QueryRunner } from "typeorm";

export class addHorariosNegocio1785613711586 implements MigrationInterface {
    name = 'addHorariosNegocio1785613711586'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "negocio" ADD "modo_operacion" character varying(10) NOT NULL DEFAULT 'MANUAL'`);
        await queryRunner.query(`ALTER TABLE "negocio" ADD "hora_apertura" TIME`);
        await queryRunner.query(`ALTER TABLE "negocio" ADD "hora_cierre" TIME`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "negocio" DROP COLUMN "hora_cierre"`);
        await queryRunner.query(`ALTER TABLE "negocio" DROP COLUMN "hora_apertura"`);
        await queryRunner.query(`ALTER TABLE "negocio" DROP COLUMN "modo_operacion"`);
    }
}
