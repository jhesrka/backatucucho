import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPrepTimeAndProductType1778085679409 implements MigrationInterface {
    name = 'AddPrepTimeAndProductType1778085679409'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "subcategoria_negocio" DROP CONSTRAINT "FK_subcategoria_categoria"`);
        await queryRunner.query(`ALTER TABLE "negocio" DROP CONSTRAINT "FK_negocio_subcategoria"`);
        await queryRunner.query(`ALTER TABLE "producto_pedido" DROP CONSTRAINT "FK_producto_pedido_producto"`);
        await queryRunner.query(`ALTER TABLE "transaccion_motorizado" DROP CONSTRAINT "FK_transaccion_motorizado_pedido"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_recharge_approved_unique"`);
        await queryRunner.query(`ALTER TABLE "post" DROP COLUMN "contentType"`);
        await queryRunner.query(`ALTER TABLE "post" DROP COLUMN "videoUrl"`);
        await queryRunner.query(`ALTER TABLE "post" DROP COLUMN "videoPlatform"`);
        await queryRunner.query(`ALTER TABLE "post" DROP COLUMN "videoId"`);
        await queryRunner.query(`ALTER TABLE "post" DROP COLUMN "videoEmbedUrl"`);
        await queryRunner.query(`ALTER TABLE "post" DROP COLUMN "videoOriginalUrl"`);
        await queryRunner.query(`CREATE TYPE "public"."producto_tipoproducto_enum" AS ENUM('NORMAL', 'PROGRAMADO')`);
        await queryRunner.query(`ALTER TABLE "producto" ADD "tipoProducto" "public"."producto_tipoproducto_enum" NOT NULL DEFAULT 'NORMAL'`);
        await queryRunner.query(`ALTER TABLE "negocio" ADD "tiempoPreparacionMin" integer NOT NULL DEFAULT '15'`);
        await queryRunner.query(`ALTER TABLE "negocio" ADD "tiempoPreparacionMax" integer NOT NULL DEFAULT '30'`);
        await queryRunner.query(`ALTER TABLE "negocio" ADD "permiteProductosProgramados" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "negocio" ADD "tiempoProgramadoMin" integer`);
        await queryRunner.query(`ALTER TABLE "negocio" ADD "tiempoProgramadoMax" integer`);
        await queryRunner.query(`ALTER TABLE "pedido" ALTER COLUMN "costoEnvio" SET DEFAULT '1.25'`);
        await queryRunner.query(`ALTER TABLE "pedido" DROP COLUMN "createdAt"`);
        await queryRunner.query(`ALTER TABLE "pedido" ADD "createdAt" TIMESTAMP NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "pedido" DROP COLUMN "updatedAt"`);
        await queryRunner.query(`ALTER TABLE "pedido" ADD "updatedAt" TIMESTAMP NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "transaccion_motorizado" DROP COLUMN "createdAt"`);
        await queryRunner.query(`ALTER TABLE "transaccion_motorizado" ADD "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "transaccion_motorizado" DROP COLUMN "updated_at"`);
        await queryRunner.query(`ALTER TABLE "transaccion_motorizado" ADD "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "price_settings" ALTER COLUMN "extraDayPrice" SET DEFAULT '0.25'`);
        await queryRunner.query(`ALTER TABLE "delivery_settings" ALTER COLUMN "firstRangeFee" SET DEFAULT '1.25'`);
        await queryRunner.query(`ALTER TABLE "delivery_settings" ALTER COLUMN "extraStepFee" SET DEFAULT '0.25'`);
        await queryRunner.query(`ALTER TABLE "producto_pedido" ADD CONSTRAINT "FK_fab0e14fa7c27eef18fac5bc6d1" FOREIGN KEY ("productoId") REFERENCES "producto"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "transaccion_motorizado" ADD CONSTRAINT "FK_7f1c334d26acf9fcc378326be0f" FOREIGN KEY ("pedidoId") REFERENCES "pedido"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "transaccion_motorizado" DROP CONSTRAINT "FK_7f1c334d26acf9fcc378326be0f"`);
        await queryRunner.query(`ALTER TABLE "producto_pedido" DROP CONSTRAINT "FK_fab0e14fa7c27eef18fac5bc6d1"`);
        await queryRunner.query(`ALTER TABLE "delivery_settings" ALTER COLUMN "extraStepFee" SET DEFAULT 0.25`);
        await queryRunner.query(`ALTER TABLE "delivery_settings" ALTER COLUMN "firstRangeFee" SET DEFAULT 1.25`);
        await queryRunner.query(`ALTER TABLE "price_settings" ALTER COLUMN "extraDayPrice" SET DEFAULT 0.25`);
        await queryRunner.query(`ALTER TABLE "transaccion_motorizado" DROP COLUMN "updated_at"`);
        await queryRunner.query(`ALTER TABLE "transaccion_motorizado" ADD "updated_at" TIMESTAMP NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "transaccion_motorizado" DROP COLUMN "createdAt"`);
        await queryRunner.query(`ALTER TABLE "transaccion_motorizado" ADD "createdAt" TIMESTAMP NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "pedido" DROP COLUMN "updatedAt"`);
        await queryRunner.query(`ALTER TABLE "pedido" ADD "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "pedido" DROP COLUMN "createdAt"`);
        await queryRunner.query(`ALTER TABLE "pedido" ADD "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "pedido" ALTER COLUMN "costoEnvio" SET DEFAULT 1.25`);
        await queryRunner.query(`ALTER TABLE "negocio" DROP COLUMN "tiempoProgramadoMax"`);
        await queryRunner.query(`ALTER TABLE "negocio" DROP COLUMN "tiempoProgramadoMin"`);
        await queryRunner.query(`ALTER TABLE "negocio" DROP COLUMN "permiteProductosProgramados"`);
        await queryRunner.query(`ALTER TABLE "negocio" DROP COLUMN "tiempoPreparacionMax"`);
        await queryRunner.query(`ALTER TABLE "negocio" DROP COLUMN "tiempoPreparacionMin"`);
        await queryRunner.query(`ALTER TABLE "producto" DROP COLUMN "tipoProducto"`);
        await queryRunner.query(`DROP TYPE "public"."producto_tipoproducto_enum"`);
        await queryRunner.query(`ALTER TABLE "post" ADD "videoOriginalUrl" character varying`);
        await queryRunner.query(`ALTER TABLE "post" ADD "videoEmbedUrl" character varying`);
        await queryRunner.query(`ALTER TABLE "post" ADD "videoId" character varying`);
        await queryRunner.query(`ALTER TABLE "post" ADD "videoPlatform" character varying`);
        await queryRunner.query(`ALTER TABLE "post" ADD "videoUrl" character varying`);
        await queryRunner.query(`ALTER TABLE "post" ADD "contentType" character varying DEFAULT 'image'`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_recharge_approved_unique" ON "recharge_requests" ("bank_name", "receipt_number", "transaction_date") WHERE (status = 'APROBADO'::recharge_requests_status_enum)`);
        await queryRunner.query(`ALTER TABLE "transaccion_motorizado" ADD CONSTRAINT "FK_transaccion_motorizado_pedido" FOREIGN KEY ("pedidoId") REFERENCES "pedido"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "producto_pedido" ADD CONSTRAINT "FK_producto_pedido_producto" FOREIGN KEY ("productoId") REFERENCES "producto"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "negocio" ADD CONSTRAINT "FK_negocio_subcategoria" FOREIGN KEY ("subcategoriaId") REFERENCES "subcategoria_negocio"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "subcategoria_negocio" ADD CONSTRAINT "FK_subcategoria_categoria" FOREIGN KEY ("categoriaId") REFERENCES "categoria_negocio"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

}
