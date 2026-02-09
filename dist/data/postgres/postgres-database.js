"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PostgresDatabase = void 0;
const typeorm_1 = require("typeorm");
const post_model_1 = require("./models/post.model");
const user_model_1 = require("./models/user.model");
const useradmin_model_1 = require("./models/useradmin.model");
const stories_model_1 = require("./models/stories.model");
const like_model_1 = require("./models/like.model");
const wallet_model_1 = require("./models/wallet.model");
const rechargeStatus_model_1 = require("./models/rechargeStatus.model");
const subscriptionStatus_model_1 = require("./models/subscriptionStatus.model");
const freePostTracker_model_1 = require("./models/freePostTracker.model");
const CategoriaNegocio_1 = require("./models/CategoriaNegocio");
const Negocio_1 = require("./models/Negocio");
const Producto_1 = require("./models/Producto");
const TipoProducto_1 = require("./models/TipoProducto");
const ProductoPedido_1 = require("./models/ProductoPedido");
const Pedido_1 = require("./models/Pedido");
const UserMotorizado_1 = require("./models/UserMotorizado");
const TransaccionMotorizado_1 = require("./models/TransaccionMotorizado");
const BalanceNegocio_1 = require("./models/BalanceNegocio");
const AdminNotification_1 = require("./models/AdminNotification");
const transactionType_model_1 = require("./models/transactionType.model");
const Campaign_1 = require("./models/Campaign");
const CampaignLog_1 = require("./models/CampaignLog");
const FinancialClosing_1 = require("./models/financial/FinancialClosing");
const report_model_1 = require("./models/report.model");
const PriceSettings_1 = require("./models/PriceSettings");
const DeliverySettings_1 = require("./models/DeliverySettings");
const global_settings_model_1 = require("./models/global-settings.model");
const CommissionLog_1 = require("./models/CommissionLog");
class PostgresDatabase {
    constructor(options) {
        this.datasource = new typeorm_1.DataSource({
            type: "postgres",
            host: options.host,
            port: options.port,
            username: options.username,
            password: options.password,
            database: options.database,
            entities: [
                user_model_1.User,
                post_model_1.Post,
                useradmin_model_1.Useradmin,
                stories_model_1.Storie,
                like_model_1.Like,
                wallet_model_1.Wallet,
                rechargeStatus_model_1.RechargeRequest,
                subscriptionStatus_model_1.Subscription,
                freePostTracker_model_1.FreePostTracker,
                transactionType_model_1.Transaction,
                CategoriaNegocio_1.CategoriaNegocio,
                Negocio_1.Negocio,
                Producto_1.Producto,
                TipoProducto_1.TipoProducto,
                UserMotorizado_1.UserMotorizado,
                ProductoPedido_1.ProductoPedido,
                Pedido_1.Pedido,
                TransaccionMotorizado_1.TransaccionMotorizado,
                BalanceNegocio_1.BalanceNegocio,
                PriceSettings_1.PriceSettings,
                DeliverySettings_1.DeliverySettings,
                AdminNotification_1.AdminNotification,
                global_settings_model_1.GlobalSettings,
                Campaign_1.Campaign,
                CampaignLog_1.CampaignLog,
                FinancialClosing_1.FinancialClosing,
                report_model_1.Report,
                CommissionLog_1.CommissionLog
            ],
            synchronize: false, // PRODUCCIÓN: SIEMPRE FALSE. Usar migraciones.
            ssl: {
                rejectUnauthorized: false,
            },
            extra: {
                options: "-c timezone=America/Guayaquil",
            },
        });
    }
    connect() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.datasource.initialize();
                console.log("database conected - Running manual migrations check");
                // Manual Migration Check for showWhatsApp and showLikes
                yield this.datasource.query(`
        CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
        ALTER TABLE "post" ADD COLUMN IF NOT EXISTS "showWhatsApp" BOOLEAN DEFAULT true;
        ALTER TABLE "post" ADD COLUMN IF NOT EXISTS "showLikes" BOOLEAN DEFAULT true;
        
        ALTER TABLE "global_settings" ADD COLUMN IF NOT EXISTS "subscriptionBasicPrice" DECIMAL(10,2) DEFAULT 5.00;
        ALTER TABLE "global_settings" ADD COLUMN IF NOT EXISTS "subscriptionBasicPromoPrice" DECIMAL(10,2);
        ALTER TABLE "global_settings" ADD COLUMN IF NOT EXISTS "subscriptionBasicDurationDays" INT DEFAULT 30;
        ALTER TABLE "global_settings" ADD COLUMN IF NOT EXISTS "rechargeRetentionDays" INT DEFAULT 60;
        ALTER TABLE "global_settings" ADD COLUMN IF NOT EXISTS "currentTermsVersion" VARCHAR(20) DEFAULT 'v1.0';
        ALTER TABLE "global_settings" ADD COLUMN IF NOT EXISTS "termsUpdatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

        -- Migración para Versionado de Términos y Privacidad
        ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "acceptedTermsVersion" VARCHAR(20) DEFAULT NULL;
        ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "acceptedTermsAt" TIMESTAMP DEFAULT NULL;
        ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "acceptedPrivacyVersion" VARCHAR(20) DEFAULT NULL;
        ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "acceptedPrivacyAt" TIMESTAMP DEFAULT NULL;
        
        -- Eliminar columnas obsoletas
        DO $$ 
        BEGIN 
          BEGIN
            ALTER TABLE "user" DROP COLUMN "acceptedTerms";
          EXCEPTION WHEN undefined_column THEN 
          END;
          BEGIN
            ALTER TABLE "user" DROP COLUMN "acceptedPrivacy";
          EXCEPTION WHEN undefined_column THEN 
          END;
        END $$;

        ALTER TABLE "recharge_requests" ADD COLUMN IF NOT EXISTS "isDuplicateWarning" BOOLEAN DEFAULT false;

        -- Audit columns for transactions (subscriptions)
        ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "daysBought" INT;
        ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "prevEndDate" TIMESTAMP;
        ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "newEndDate" TIMESTAMP;
        ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "receipt_image" TEXT;

        -- Create Partial Index for Approved Recharges
        CREATE UNIQUE INDEX IF NOT EXISTS "IDX_recharge_approved_unique" 
        ON "recharge_requests" ("bank_name", "receipt_number", "transaction_date") 
        WHERE "status" = 'APROBADO';

        -- Commission Configuration and Persistent Commission Snapshots
        ALTER TABLE "price_settings" ADD COLUMN IF NOT EXISTS "motorizadoPercentage" DECIMAL(10,2) DEFAULT 80.00;
        ALTER TABLE "price_settings" ADD COLUMN IF NOT EXISTS "appPercentage" DECIMAL(10,2) DEFAULT 20.00;

        ALTER TABLE "pedido" ADD COLUMN IF NOT EXISTS "porcentaje_motorizado_aplicado" DECIMAL(10,2) DEFAULT 80.00;
        ALTER TABLE "pedido" ADD COLUMN IF NOT EXISTS "porcentaje_app_aplicado" DECIMAL(10,2) DEFAULT 20.00;
        ALTER TABLE "pedido" ADD COLUMN IF NOT EXISTS "ganancia_motorizado" DECIMAL(10,2) DEFAULT 0;
        ALTER TABLE "pedido" ADD COLUMN IF NOT EXISTS "comision_app_domicilio" DECIMAL(10,2) DEFAULT 0;
        ALTER TABLE "pedido" ADD COLUMN IF NOT EXISTS "ganancia_app_producto" DECIMAL(10,2) DEFAULT 0;
        ALTER TABLE "pedido" ADD COLUMN IF NOT EXISTS "total_precio_venta_publico" DECIMAL(10,2) DEFAULT 0;
        ALTER TABLE "pedido" ADD COLUMN IF NOT EXISTS "total_precio_app" DECIMAL(10,2) DEFAULT 0;
        ALTER TABLE "pedido" ADD COLUMN IF NOT EXISTS "total_comision_productos" DECIMAL(10,2) DEFAULT 0;
        ALTER TABLE "pedido" ADD COLUMN IF NOT EXISTS "pago_motorizado" DECIMAL(10,2) DEFAULT 0;
        ALTER TABLE "pedido" ADD COLUMN IF NOT EXISTS "comision_moto_app" DECIMAL(10,2) DEFAULT 0;

        -- Migración de Precios en PRODUCTOS
        ALTER TABLE "producto" ADD COLUMN IF NOT EXISTS "precio_venta" DECIMAL(10,2) DEFAULT 0;
        ALTER TABLE "producto" ADD COLUMN IF NOT EXISTS "precio_app" DECIMAL(10,2) DEFAULT 0;
        ALTER TABLE "producto" ADD COLUMN IF NOT EXISTS "comision_producto" DECIMAL(10,2) DEFAULT 0;

        DO $$ 
        BEGIN 
          IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='producto' AND column_name='precio') THEN
            UPDATE "producto" 
            SET "precio_venta" = "precio", 
                "precio_app" = COALESCE("precioParaApp", "precio"),
                "comision_producto" = "precio" - COALESCE("precioParaApp", "precio")
            WHERE "precio_venta" = 0 AND "precio_app" = 0;
          END IF;

          -- FIX ALWAYS: Recalculate commissions that are 0 but should have a value
          UPDATE "producto" 
          SET "comision_producto" = "precio_venta" - "precio_app"
          WHERE "comision_producto" = 0 AND "precio_venta" != "precio_app";

          -- Fix order items as well
          UPDATE "producto_pedido"
          SET "comision_producto" = "precio_venta" - "precio_app"
          WHERE "comision_producto" = 0 AND "precio_venta" != "precio_app";
        END $$;

        -- Paso 3: Eliminar campos antiguos
        DO $$ 
        BEGIN 
          BEGIN
            ALTER TABLE "producto" DROP COLUMN "precio";
          EXCEPTION WHEN undefined_column THEN END;
          BEGIN
            ALTER TABLE "producto" DROP COLUMN "precioParaApp";
          EXCEPTION WHEN undefined_column THEN END;
        END $$;

        -- Aplicar lo mismo para PRODUCTO_PEDIDO
        ALTER TABLE "producto_pedido" ADD COLUMN IF NOT EXISTS "precio_venta" DECIMAL(10,2) DEFAULT 0;
        ALTER TABLE "producto_pedido" ADD COLUMN IF NOT EXISTS "precio_app" DECIMAL(10,2) DEFAULT 0;
        ALTER TABLE "producto_pedido" ADD COLUMN IF NOT EXISTS "comision_producto" DECIMAL(10,2) DEFAULT 0;

        DO $$ 
        BEGIN 
          IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='producto_pedido' AND column_name='precioPublico') THEN
            UPDATE "producto_pedido"
            SET "precio_venta" = "precioPublico",
                "precio_app" = "precioUnitario",
                "comision_producto" = "precioPublico" - "precioUnitario"
            WHERE "precio_venta" = 0 AND "precio_app" = 0;
          END IF;
          -- Fix any records that might have been migrated but have 0 commission
          UPDATE "producto_pedido"
          SET "comision_producto" = "precio_venta" - "precio_app"
          WHERE "comision_producto" = 0 AND "precio_venta" != "precio_app";
        END $$;

        DO $$ 
        BEGIN 
          BEGIN
            ALTER TABLE "producto_pedido" DROP COLUMN "precioPublico";
          EXCEPTION WHEN undefined_column THEN END;
          BEGIN
            ALTER TABLE "producto_pedido" DROP COLUMN "precioUnitario";
          EXCEPTION WHEN undefined_column THEN END;
          BEGIN
            ALTER TABLE "producto_pedido" DROP COLUMN "comision";
          EXCEPTION WHEN undefined_column THEN END;
        END $$;

        CREATE TABLE IF NOT EXISTS "commission_log" (
          "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
          "prevMotorizadoPercentage" decimal(10,2) NOT NULL,
          "newMotorizadoPercentage" decimal(10,2) NOT NULL,
          "prevAppPercentage" decimal(10,2) NOT NULL,
          "newAppPercentage" decimal(10,2) NOT NULL,
          "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
          "changedById" uuid,
          CONSTRAINT "PK_commission_log" PRIMARY KEY ("id")
        );

        DO $$ 
        BEGIN 
          IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_commission_log_useradmin') THEN
            ALTER TABLE "commission_log" ADD CONSTRAINT "FK_commission_log_useradmin" FOREIGN KEY ("changedById") REFERENCES "useradmin"("id");
          END IF;
        END $$;
      `);
                console.log("Manual migrations applied/checked successfully");
            }
            catch (error) {
                console.log("DB Connection Error:", error);
                throw error;
            }
        });
    }
}
exports.PostgresDatabase = PostgresDatabase;
