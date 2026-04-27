import { MigrationInterface, QueryRunner } from "typeorm";

export class AddClienteConfirmoLlegadaToPedido1777309894369 implements MigrationInterface {
    name = 'AddClienteConfirmoLlegadaToPedido1777309894369'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "subcategoria_negocio" DROP CONSTRAINT "FK_subcategoria_categoria"`);
        await queryRunner.query(`ALTER TABLE "negocio" DROP CONSTRAINT "FK_negocio_subcategoria"`);
        await queryRunner.query(`ALTER TABLE "producto_pedido" DROP CONSTRAINT "FK_producto_pedido_producto"`);
        await queryRunner.query(`ALTER TABLE "transaccion_motorizado" DROP CONSTRAINT "FK_transaccion_motorizado_pedido"`);
        await queryRunner.query(`ALTER TABLE "push_token" DROP CONSTRAINT "FK_push_token_user"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_recharge_approved_unique"`);
        await queryRunner.query(`ALTER TABLE "post" DROP COLUMN "contentType"`);
        await queryRunner.query(`ALTER TABLE "post" DROP COLUMN "videoUrl"`);
        await queryRunner.query(`ALTER TABLE "post" DROP COLUMN "videoPlatform"`);
        await queryRunner.query(`ALTER TABLE "post" DROP COLUMN "videoId"`);
        await queryRunner.query(`ALTER TABLE "post" DROP COLUMN "videoEmbedUrl"`);
        await queryRunner.query(`ALTER TABLE "post" DROP COLUMN "videoOriginalUrl"`);
        await queryRunner.query(`ALTER TABLE "pedido" ADD "cliente_confirmo_llegada" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "recharge_requests" ALTER COLUMN "baseAmount" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "recharge_requests" ALTER COLUMN "baseAmount" SET DEFAULT '0'`);
        await queryRunner.query(`ALTER TABLE "recharge_requests" ALTER COLUMN "feeAmount" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "recharge_requests" ALTER COLUMN "feeAmount" SET DEFAULT '0'`);
        await queryRunner.query(`ALTER TABLE "recharge_requests" ALTER COLUMN "appliedPercentage" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "recharge_requests" ALTER COLUMN "appliedPercentage" SET DEFAULT '0'`);
        await queryRunner.query(`ALTER TABLE "subcategoria_negocio" ALTER COLUMN "orden" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "pedido" ALTER COLUMN "costoEnvio" SET DEFAULT '1.25'`);
        await queryRunner.query(`ALTER TABLE "pedido" DROP COLUMN "createdAt"`);
        await queryRunner.query(`ALTER TABLE "pedido" ADD "createdAt" TIMESTAMP NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "pedido" DROP COLUMN "updatedAt"`);
        await queryRunner.query(`ALTER TABLE "pedido" ADD "updatedAt" TIMESTAMP NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "producto_pedido" ALTER COLUMN "producto_nombre" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "producto_pedido" ALTER COLUMN "producto_imagen" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "user_motorizado" ALTER COLUMN "updatedAt" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "transactions" DROP COLUMN "reason"`);
        await queryRunner.query(`DROP TYPE "public"."transactions_reason_enum"`);
        await queryRunner.query(`ALTER TABLE "transactions" ADD "reason" character varying NOT NULL DEFAULT 'RECHARGE'`);
        await queryRunner.query(`ALTER TABLE "price_settings" ALTER COLUMN "extraDayPrice" SET DEFAULT '0.25'`);
        await queryRunner.query(`ALTER TABLE "delivery_settings" ALTER COLUMN "firstRangeFee" SET DEFAULT '1.25'`);
        await queryRunner.query(`ALTER TABLE "delivery_settings" ALTER COLUMN "extraStepFee" SET DEFAULT '0.25'`);
        await queryRunner.query(`ALTER TABLE "global_settings" ALTER COLUMN "payphoneRechargePercentage" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "global_settings" ALTER COLUMN "payphoneRechargePercentage" SET DEFAULT '0'`);
        await queryRunner.query(`ALTER TABLE "user" ALTER COLUMN "cancellation_strikes" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "subcategoria_negocio" ADD CONSTRAINT "FK_193b57d1e677965480fae67cb96" FOREIGN KEY ("categoriaId") REFERENCES "categoria_negocio"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "negocio" ADD CONSTRAINT "FK_ddcaad316d71ac8e8aa0310bbae" FOREIGN KEY ("subcategoriaId") REFERENCES "subcategoria_negocio"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "producto_pedido" ADD CONSTRAINT "FK_fab0e14fa7c27eef18fac5bc6d1" FOREIGN KEY ("productoId") REFERENCES "producto"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "transaccion_motorizado" ADD CONSTRAINT "FK_7f1c334d26acf9fcc378326be0f" FOREIGN KEY ("pedidoId") REFERENCES "pedido"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "push_token" ADD CONSTRAINT "FK_bfaf1e0dcf71f97f4783c6b2ba4" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "push_token" DROP CONSTRAINT "FK_bfaf1e0dcf71f97f4783c6b2ba4"`);
        await queryRunner.query(`ALTER TABLE "transaccion_motorizado" DROP CONSTRAINT "FK_7f1c334d26acf9fcc378326be0f"`);
        await queryRunner.query(`ALTER TABLE "producto_pedido" DROP CONSTRAINT "FK_fab0e14fa7c27eef18fac5bc6d1"`);
        await queryRunner.query(`ALTER TABLE "negocio" DROP CONSTRAINT "FK_ddcaad316d71ac8e8aa0310bbae"`);
        await queryRunner.query(`ALTER TABLE "subcategoria_negocio" DROP CONSTRAINT "FK_193b57d1e677965480fae67cb96"`);
        await queryRunner.query(`ALTER TABLE "user" ALTER COLUMN "cancellation_strikes" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "global_settings" ALTER COLUMN "payphoneRechargePercentage" SET DEFAULT 0.00`);
        await queryRunner.query(`ALTER TABLE "global_settings" ALTER COLUMN "payphoneRechargePercentage" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "delivery_settings" ALTER COLUMN "extraStepFee" SET DEFAULT 0.25`);
        await queryRunner.query(`ALTER TABLE "delivery_settings" ALTER COLUMN "firstRangeFee" SET DEFAULT 1.25`);
        await queryRunner.query(`ALTER TABLE "price_settings" ALTER COLUMN "extraDayPrice" SET DEFAULT 0.25`);
        await queryRunner.query(`ALTER TABLE "transactions" DROP COLUMN "reason"`);
        await queryRunner.query(`CREATE TYPE "public"."transactions_reason_enum" AS ENUM('RECHARGE', 'SUBSCRIPTION', 'ADMIN_ADJUSTMENT', 'REVERSAL', 'ORDER', 'REFUND', 'STORIE', 'WITHDRAWAL', 'CASH_RECHARGE')`);
        await queryRunner.query(`ALTER TABLE "transactions" ADD "reason" "public"."transactions_reason_enum" NOT NULL DEFAULT 'RECHARGE'`);
        await queryRunner.query(`ALTER TABLE "user_motorizado" ALTER COLUMN "updatedAt" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "producto_pedido" ALTER COLUMN "producto_imagen" SET DEFAULT NULL`);
        await queryRunner.query(`ALTER TABLE "producto_pedido" ALTER COLUMN "producto_nombre" SET DEFAULT NULL`);
        await queryRunner.query(`ALTER TABLE "pedido" DROP COLUMN "updatedAt"`);
        await queryRunner.query(`ALTER TABLE "pedido" ADD "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "pedido" DROP COLUMN "createdAt"`);
        await queryRunner.query(`ALTER TABLE "pedido" ADD "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "pedido" ALTER COLUMN "costoEnvio" SET DEFAULT 1.25`);
        await queryRunner.query(`ALTER TABLE "subcategoria_negocio" ALTER COLUMN "orden" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "recharge_requests" ALTER COLUMN "appliedPercentage" SET DEFAULT 0.00`);
        await queryRunner.query(`ALTER TABLE "recharge_requests" ALTER COLUMN "appliedPercentage" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "recharge_requests" ALTER COLUMN "feeAmount" SET DEFAULT 0.00`);
        await queryRunner.query(`ALTER TABLE "recharge_requests" ALTER COLUMN "feeAmount" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "recharge_requests" ALTER COLUMN "baseAmount" SET DEFAULT 0.00`);
        await queryRunner.query(`ALTER TABLE "recharge_requests" ALTER COLUMN "baseAmount" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "pedido" DROP COLUMN "cliente_confirmo_llegada"`);
        await queryRunner.query(`ALTER TABLE "post" ADD "videoOriginalUrl" character varying`);
        await queryRunner.query(`ALTER TABLE "post" ADD "videoEmbedUrl" character varying`);
        await queryRunner.query(`ALTER TABLE "post" ADD "videoId" character varying`);
        await queryRunner.query(`ALTER TABLE "post" ADD "videoPlatform" character varying`);
        await queryRunner.query(`ALTER TABLE "post" ADD "videoUrl" character varying`);
        await queryRunner.query(`ALTER TABLE "post" ADD "contentType" character varying DEFAULT 'image'`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_recharge_approved_unique" ON "recharge_requests" ("bank_name", "receipt_number", "transaction_date") WHERE (status = 'APROBADO'::recharge_requests_status_enum)`);
        await queryRunner.query(`ALTER TABLE "push_token" ADD CONSTRAINT "FK_push_token_user" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "transaccion_motorizado" ADD CONSTRAINT "FK_transaccion_motorizado_pedido" FOREIGN KEY ("pedidoId") REFERENCES "pedido"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "producto_pedido" ADD CONSTRAINT "FK_producto_pedido_producto" FOREIGN KEY ("productoId") REFERENCES "producto"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "negocio" ADD CONSTRAINT "FK_negocio_subcategoria" FOREIGN KEY ("subcategoriaId") REFERENCES "subcategoria_negocio"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "subcategoria_negocio" ADD CONSTRAINT "FK_subcategoria_categoria" FOREIGN KEY ("categoriaId") REFERENCES "categoria_negocio"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

}
