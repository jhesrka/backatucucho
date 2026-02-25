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
const PostReport_1 = require("./models/PostReport");
const StorieReport_1 = require("./models/StorieReport");
const ModerationLog_1 = require("./models/ModerationLog");
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
                CommissionLog_1.CommissionLog,
                PostReport_1.PostReport,
                StorieReport_1.StorieReport,
                ModerationLog_1.ModerationLog
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
                // 1. Core Extensions and structural changes
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
        ALTER TABLE "global_settings" ADD COLUMN IF NOT EXISTS "reportsRetentionDays" INT DEFAULT 30;

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
          EXCEPTION WHEN undefined_column THEN END;
          BEGIN
            ALTER TABLE "user" DROP COLUMN "acceptedPrivacy";
          EXCEPTION WHEN undefined_column THEN END;
        END $$;
        
        ALTER TABLE "recharge_requests" ADD COLUMN IF NOT EXISTS "isDuplicateWarning" BOOLEAN DEFAULT false;
        
        -- Audit columns for transactions (subscriptions)
        ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "daysBought" INT;
        ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "prevEndDate" TIMESTAMP;
        ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "newEndDate" TIMESTAMP;
        ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "receipt_image" TEXT;

        CREATE UNIQUE INDEX IF NOT EXISTS "IDX_recharge_approved_unique" 
        ON "recharge_requests" ("bank_name", "receipt_number", "transaction_date") 
        WHERE "status" = 'APROBADO';

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

        ALTER TABLE "producto" ADD COLUMN IF NOT EXISTS "precio_venta" DECIMAL(10,2) DEFAULT 0;
        ALTER TABLE "producto" ADD COLUMN IF NOT EXISTS "precio_app" DECIMAL(10,2) DEFAULT 0;
        ALTER TABLE "producto" ADD COLUMN IF NOT EXISTS "comision_producto" DECIMAL(10,2) DEFAULT 0;

        DO $$ 
        BEGIN 
          IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='producto' AND column_name='precio') THEN
            UPDATE "producto" SET "precio_venta" = "precio", "precio_app" = COALESCE("precioParaApp", "precio"), "comision_producto" = "precio" - COALESCE("precioParaApp", "precio") WHERE "precio_venta" = 0 AND "precio_app" = 0;
          END IF;
          UPDATE "producto" SET "comision_producto" = "precio_venta" - "precio_app" WHERE "comision_producto" = 0 AND "precio_venta" != "precio_app";
        END $$;

        ALTER TABLE "producto_pedido" ADD COLUMN IF NOT EXISTS "precio_venta" DECIMAL(10,2) DEFAULT 0;
        ALTER TABLE "producto_pedido" ADD COLUMN IF NOT EXISTS "precio_app" DECIMAL(10,2) DEFAULT 0;
        ALTER TABLE "producto_pedido" ADD COLUMN IF NOT EXISTS "comision_producto" DECIMAL(10,2) DEFAULT 0;

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

        CREATE TABLE IF NOT EXISTS "financial_closings" (
          "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
          "closingDate" date NOT NULL UNIQUE,
          "totalIncome" decimal(10,2) NOT NULL,
          "totalExpenses" decimal(10,2) NOT NULL,
          "backupFileUrl" varchar NOT NULL,
          "totalRechargesCount" int NOT NULL,
          "totalUserBalance" decimal(10,2) NOT NULL DEFAULT 0,
          "totalMotorizadoDebt" decimal(10,2) NOT NULL DEFAULT 0,
          "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
          "closedById" uuid,
          CONSTRAINT "PK_financial_closings" PRIMARY KEY ("id")
        );

        CREATE TABLE IF NOT EXISTS "balance_negocio" (
          "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
          "fecha" date NOT NULL,
          "totalVendido" decimal(10,2) NOT NULL DEFAULT 0,
          "totalComisionApp" decimal(10,2) NOT NULL DEFAULT 0,
          "totalEfectivo" decimal(10,2) NOT NULL DEFAULT 0,
          "totalTransferencia" decimal(10,2) NOT NULL DEFAULT 0,
          "balanceFinal" decimal(10,2) NOT NULL DEFAULT 0,
          "estado" varchar NOT NULL DEFAULT 'PENDIENTE',
          "comprobanteUrl" text,
          "isClosed" boolean NOT NULL DEFAULT false,
          "closedById" uuid,
          "negocioId" uuid,
          "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
          "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
          CONSTRAINT "PK_balance_negocio" PRIMARY KEY ("id")
        );

        -- Moderation Columns
        ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "warnings_count" INT DEFAULT 0;
        ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "suspension_until" TIMESTAMP DEFAULT NULL;
        ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "isLoggedIn" BOOLEAN DEFAULT false;
        ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "currentSessionId" VARCHAR;
        ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "lastLoginIP" VARCHAR;
        ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "lastLoginCountry" VARCHAR;
        ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "lastLoginDate" TIMESTAMP;
        ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "lastDeviceInfo" VARCHAR;

        CREATE TABLE IF NOT EXISTS "moderation_log" (
            "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
            "adminId" uuid NOT NULL,
            "action" varchar NOT NULL,
            "comment" text NOT NULL,
            "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
            "userId" uuid,
            "postId" uuid,
            "storieId" uuid,
            CONSTRAINT "PK_moderation_log" PRIMARY KEY ("id")
        );

        CREATE TABLE IF NOT EXISTS "post_report" (
            "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
            "reason" varchar NOT NULL,
            "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
            "reporterId" uuid,
            "postId" uuid,
            CONSTRAINT "PK_post_report" PRIMARY KEY ("id")
        );

        CREATE TABLE IF NOT EXISTS "storie_report" (
            "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
            "reason" varchar NOT NULL,
            "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
            "reporterId" uuid,
            "storieId" uuid,
            CONSTRAINT "PK_storie_report" PRIMARY KEY ("id")
        );

        -- Add status column if missing (Manual Migration)
        ALTER TABLE "post_report" ADD COLUMN IF NOT EXISTS "status" VARCHAR DEFAULT 'PENDING';
        ALTER TABLE "storie_report" ADD COLUMN IF NOT EXISTS "status" VARCHAR DEFAULT 'PENDING';

        DO $$ 
        BEGIN 
            IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_moderation_log_user') THEN
                ALTER TABLE "moderation_log" ADD CONSTRAINT "FK_moderation_log_user" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE SET NULL;
            END IF;
            IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_moderation_log_post') THEN
                ALTER TABLE "moderation_log" ADD CONSTRAINT "FK_moderation_log_post" FOREIGN KEY ("postId") REFERENCES "post"("id") ON DELETE SET NULL;
            END IF;
            IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_moderation_log_storie') THEN
                ALTER TABLE "moderation_log" ADD CONSTRAINT "FK_moderation_log_storie" FOREIGN KEY ("storieId") REFERENCES "storie"("id") ON DELETE SET NULL;
            END IF;
            IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_post_report_user') THEN
                ALTER TABLE "post_report" ADD CONSTRAINT "FK_post_report_user" FOREIGN KEY ("reporterId") REFERENCES "user"("id") ON DELETE SET NULL;
            END IF;
            IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_post_report_post') THEN
                ALTER TABLE "post_report" ADD CONSTRAINT "FK_post_report_post" FOREIGN KEY ("postId") REFERENCES "post"("id") ON DELETE CASCADE;
            END IF;
            IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_storie_report_user') THEN
                ALTER TABLE "storie_report" ADD CONSTRAINT "FK_storie_report_user" FOREIGN KEY ("reporterId") REFERENCES "user"("id") ON DELETE SET NULL;
            END IF;
            IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_storie_report_storie') THEN
                ALTER TABLE "storie_report" ADD CONSTRAINT "FK_storie_report_storie" FOREIGN KEY ("storieId") REFERENCES "storie"("id") ON DELETE CASCADE;
            END IF;
        END $$;
      `);
                // 2. Enum Additions (Individual calls to ensure they commit)
                const enums = [
                    { type: 'user_status_enum', label: 'SUSPENDED' },
                    { type: 'post_statuspost_enum', label: 'FLAGGED' },
                    { type: 'post_statuspost_enum', label: 'PUBLISHED' },
                    { type: 'post_statuspost_enum', label: 'HIDDEN' },
                    { type: 'storie_statusstorie_enum', label: 'FLAGGED' },
                    { type: 'storie_statusstorie_enum', label: 'PUBLISHED' },
                    { type: 'storie_statusstorie_enum', label: 'HIDDEN' },
                ];
                for (const e of enums) {
                    try {
                        const exists = yield this.datasource.query(`SELECT 1 FROM pg_enum WHERE enumlabel = '${e.label}' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = '${e.type}')`);
                        if (exists.length === 0) {
                            yield this.datasource.query(`ALTER TYPE "${e.type}" ADD VALUE '${e.label}'`);
                            console.log(`Enum value ${e.label} added to ${e.type}`);
                        }
                    }
                    catch (err) {
                        console.warn(`Could not add enum ${e.label} to ${e.type}:`, err.message);
                    }
                }
                // 3. Data Migrations (with improved mapping)
                yield this.datasource.query(`
        -- Migración para POSTS
        UPDATE post SET "statusPost" = 'PUBLISHED' WHERE "statusPost"::text IN ('PUBLICADO', 'publicado');
        UPDATE post SET "statusPost" = 'HIDDEN'    WHERE "statusPost"::text IN ('BLOQUEADO', 'bloqueado', 'OCULTO', 'oculto');
        UPDATE post SET "statusPost" = 'DELETED'   WHERE "statusPost"::text IN ('ELIMINADO', 'eliminado');
        UPDATE post SET "statusPost" = 'FLAGGED'   WHERE "statusPost"::text IN ('REPORTADO', 'reportado');
        
        -- Migración para STORIES
        UPDATE storie SET "statusStorie" = 'PUBLISHED' WHERE "statusStorie"::text IN ('PUBLICADO', 'publicado');
        UPDATE storie SET "statusStorie" = 'HIDDEN'    WHERE "statusStorie"::text IN ('BLOQUEADO', 'bloqueado', 'OCULTO', 'oculto');
        UPDATE storie SET "statusStorie" = 'DELETED'   WHERE "statusStorie"::text IN ('ELIMINADO', 'eliminado');
        UPDATE storie SET "statusStorie" = 'FLAGGED'   WHERE "statusStorie"::text IN ('REPORTADO', 'reportado');
      `).catch(err => console.warn("Data migration failed or partially completed:", err.message));
                console.log("Manual migrations applied/checked successfully");
                // 4. Negocio Order Migration
                yield this.datasource.query(`
        ALTER TABLE "negocio" ADD COLUMN IF NOT EXISTS "orden" INT DEFAULT 0;
      `).catch(err => console.warn("Negocio order migration failed:", err.message));
                // 5. Categoria Negocio Order Migration
                yield this.datasource.query(`
        ALTER TABLE "categoria_negocio" ADD COLUMN IF NOT EXISTS "orden" INT DEFAULT 0;
        ALTER TABLE "categoria_negocio" ADD COLUMN IF NOT EXISTS "modeloBloqueado" BOOLEAN DEFAULT false;
        ALTER TABLE "categoria_negocio" ADD COLUMN IF NOT EXISTS "modeloMonetizacionDefault" VARCHAR DEFAULT NULL;
      `).catch(err => console.warn("Categoria Negocio order migration failed:", err.message));
            }
            catch (error) {
                console.log("DB Connection Error:", error);
                throw error;
            }
        });
    }
}
exports.PostgresDatabase = PostgresDatabase;
