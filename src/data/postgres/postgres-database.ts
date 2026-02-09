import { DataSource } from "typeorm";
import { Post } from "./models/post.model";
import { User } from "./models/user.model";
import { Useradmin } from "./models/useradmin.model";
import { Storie } from "./models/stories.model";
import { Like } from "./models/like.model";
import { Wallet } from "./models/wallet.model";
import { RechargeRequest } from "./models/rechargeStatus.model";
import { Subscription } from "./models/subscriptionStatus.model";
import { FreePostTracker } from "./models/freePostTracker.model";
import { CategoriaNegocio } from "./models/CategoriaNegocio";
import { Negocio } from "./models/Negocio";
import { Producto } from "./models/Producto";
import { TipoProducto } from "./models/TipoProducto";
import { ProductoPedido } from "./models/ProductoPedido";
import { Pedido } from "./models/Pedido";
import { UserMotorizado } from "./models/UserMotorizado";
import { TransaccionMotorizado } from "./models/TransaccionMotorizado";
import { BalanceNegocio } from "./models/BalanceNegocio";
import { AdminNotification } from "./models/AdminNotification";
import { Transaction } from "./models/transactionType.model";
import { Campaign } from "./models/Campaign";
import { CampaignLog } from "./models/CampaignLog";
import { FinancialClosing } from "./models/financial/FinancialClosing";
import { Report } from "./models/report.model";
import { PriceSettings } from "./models/PriceSettings";
import { DeliverySettings } from "./models/DeliverySettings";
import { GlobalSettings } from "./models/global-settings.model";
import { CommissionLog } from "./models/CommissionLog";
interface Options {
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
}

export class PostgresDatabase {
  public datasource: DataSource;

  constructor(options: Options) {
    this.datasource = new DataSource({
      type: "postgres",
      host: options.host,
      port: options.port,
      username: options.username,
      password: options.password,
      database: options.database,
      entities: [
        User,
        Post,
        Useradmin,
        Storie,
        Like,
        Wallet,
        RechargeRequest,
        Subscription,
        FreePostTracker,
        Transaction,
        CategoriaNegocio,
        Negocio,
        Producto,
        TipoProducto,
        UserMotorizado,
        ProductoPedido,
        Pedido,
        TransaccionMotorizado,
        BalanceNegocio,
        PriceSettings,
        DeliverySettings,
        AdminNotification,
        GlobalSettings,
        Campaign,
        CampaignLog,
        FinancialClosing,
        Report,
        CommissionLog
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

  async connect() {
    try {
      await this.datasource.initialize();
      console.log("database conected - Running manual migrations check");

      // Manual Migration Check for showWhatsApp and showLikes
      await this.datasource.query(`
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

        -- Migración para Financial Closing (Snapshot Deudas)
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
          CONSTRAINT "PK_financial_closings" PRIMARY KEY ("id"),
          CONSTRAINT "FK_financial_closings_useradmin" FOREIGN KEY ("closedById") REFERENCES "useradmin"("id")
        );

        -- Asegurar columnas si la tabla ya existía sin ellas
        ALTER TABLE "financial_closings" ADD COLUMN IF NOT EXISTS "totalUserBalance" decimal(10,2) DEFAULT 0;
        ALTER TABLE "financial_closings" ADD COLUMN IF NOT EXISTS "totalMotorizadoDebt" decimal(10,2) DEFAULT 0;

        -- Migración para Balance Negocio (Cuadre por local)
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

        -- Asegurar columnas y relaciones
        ALTER TABLE "balance_negocio" ADD COLUMN IF NOT EXISTS "totalComisionApp" decimal(10,2) DEFAULT 0;
        ALTER TABLE "balance_negocio" ADD COLUMN IF NOT EXISTS "isClosed" boolean DEFAULT false;
        ALTER TABLE "balance_negocio" ADD COLUMN IF NOT EXISTS "closedById" uuid;
        
        DO $$ 
        BEGIN 
          IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_balance_negocio_useradmin') THEN
            ALTER TABLE "balance_negocio" ADD CONSTRAINT "FK_balance_negocio_useradmin" FOREIGN KEY ("closedById") REFERENCES "useradmin"("id");
          END IF;
          IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_balance_negocio_negocio') THEN
            ALTER TABLE "balance_negocio" ADD CONSTRAINT "FK_balance_negocio_negocio" FOREIGN KEY ("negocioId") REFERENCES "negocio"("id");
          END IF;
        END $$;
      `);

      console.log("Manual migrations applied/checked successfully");
    } catch (error) {
      console.log("DB Connection Error:", error);
      throw error;
    }
  }
}
