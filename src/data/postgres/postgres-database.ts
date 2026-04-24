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
import { SubcategoriaNegocio } from "./models/SubcategoriaNegocio";
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
import { PostReport } from "./models/PostReport";
import { StorieReport } from "./models/StorieReport";
import { ModerationLog } from "./models/ModerationLog";
import { WalletMovement } from "./models/wallet-movement.model";
import { BankAccount } from "./models/BankAccount";
import { PushToken } from "./models/PushToken";
import { PedidoOperativoLog } from "./models/PedidoOperativoLog";

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
        SubcategoriaNegocio,
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
        CommissionLog,
        PostReport,
        StorieReport,
        ModerationLog,
        WalletMovement,
        BankAccount,
        PushToken,
        PedidoOperativoLog
      ],
      synchronize: false, // PRODUCCIÓN: SIEMPRE FALSE. Usar migraciones.
      ssl: {
        rejectUnauthorized: false,
      },
      // Configuración de pool para mayor estabilidad en Neon
      extra: {
        max: 20, // Límite de conexiones para evitar agotar el plan (Neon free tier)
        idleTimeoutMillis: 30000, // Cerrar conexiones ociosas
        connectionTimeoutMillis: 10000, // Tiempo máximo de espera para abrir conexión
      },
      // Eliminamos el forzado de timezone de sesión para que el driver pg
      // maneje todo en UTC de forma nativa y TypeORM no se confunda.
    });
  }

  async connect() {
    try {
      await this.datasource.initialize();
      console.log("database conected - Running manual migrations check");

      // 1. Core Extensions and structural changes (DIVIDIDO PARA EVITAR DEADLOCKS)
      console.log("🛠️  [Migration] Step 1: Extensions and Post columns");
      await this.datasource.query(`SET timezone = 'UTC';`);
      await this.datasource.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`);
      
      await this.datasource.query(`ALTER TABLE "post" ADD COLUMN IF NOT EXISTS "showWhatsApp" BOOLEAN DEFAULT true;`);
      await this.datasource.query(`ALTER TABLE "post" ADD COLUMN IF NOT EXISTS "showLikes" BOOLEAN DEFAULT true;`);
      await this.datasource.query(`ALTER TABLE "post" ADD COLUMN IF NOT EXISTS "contentType" VARCHAR DEFAULT 'image';`);
      await this.datasource.query(`ALTER TABLE "post" ADD COLUMN IF NOT EXISTS "videoUrl" VARCHAR DEFAULT NULL;`);
      await this.datasource.query(`ALTER TABLE "post" ADD COLUMN IF NOT EXISTS "videoPlatform" VARCHAR DEFAULT NULL;`);
      await this.datasource.query(`ALTER TABLE "post" ADD COLUMN IF NOT EXISTS "videoId" VARCHAR DEFAULT NULL;`);
      await this.datasource.query(`ALTER TABLE "post" ADD COLUMN IF NOT EXISTS "videoEmbedUrl" VARCHAR DEFAULT NULL;`);
      await this.datasource.query(`ALTER TABLE "post" ADD COLUMN IF NOT EXISTS "videoOriginalUrl" VARCHAR DEFAULT NULL;`);
      await this.datasource.query(`ALTER TABLE "post" ADD COLUMN IF NOT EXISTS "scheduledAt" TIMESTAMPTZ DEFAULT NULL;`);
      await this.datasource.query(`ALTER TABLE "post" ADD COLUMN IF NOT EXISTS "publishedAt" TIMESTAMPTZ DEFAULT NULL;`);

      console.log("🛠️  [Migration] Step 2: Global Settings");
      await this.datasource.query(`ALTER TABLE "global_settings" ADD COLUMN IF NOT EXISTS "subscriptionBasicPrice" DECIMAL(10,2) DEFAULT 5.00;`);
      await this.datasource.query(`ALTER TABLE "global_settings" ADD COLUMN IF NOT EXISTS "subscriptionBasicPromoPrice" DECIMAL(10,2);`);
      await this.datasource.query(`ALTER TABLE "global_settings" ADD COLUMN IF NOT EXISTS "subscriptionBasicDurationDays" INT DEFAULT 30;`);
      await this.datasource.query(`ALTER TABLE "global_settings" ADD COLUMN IF NOT EXISTS "rechargeRetentionDays" INT DEFAULT 60;`);
      await this.datasource.query(`ALTER TABLE "global_settings" ADD COLUMN IF NOT EXISTS "currentTermsVersion" VARCHAR(20) DEFAULT 'v1.0';`);
      await this.datasource.query(`ALTER TABLE "global_settings" ADD COLUMN IF NOT EXISTS "termsUpdatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP;`);
      await this.datasource.query(`ALTER TABLE "global_settings" ADD COLUMN IF NOT EXISTS "reportsRetentionDays" INT DEFAULT 30;`);

      console.log("🛠️  [Migration] Step 3: Timestamps alignment");
      await this.datasource.query(`ALTER TABLE "post" ALTER COLUMN "createdAt" TYPE timestamptz;`);
      await this.datasource.query(`ALTER TABLE "post" ALTER COLUMN "expiresAt" TYPE timestamptz;`);
      await this.datasource.query(`ALTER TABLE "storie" ALTER COLUMN "createdAt" TYPE timestamptz;`);
      await this.datasource.query(`ALTER TABLE "storie" ALTER COLUMN "expires_at" TYPE timestamptz;`);
      await this.datasource.query(`ALTER TABLE "storie" ALTER COLUMN "deletedAt" TYPE timestamptz;`);
      await this.datasource.query(`ALTER TABLE "recharge_requests" ALTER COLUMN "created_at" TYPE timestamptz;`);
      await this.datasource.query(`ALTER TABLE "recharge_requests" ALTER COLUMN "transaction_date" TYPE timestamptz;`);
      await this.datasource.query(`ALTER TABLE "recharge_requests" ALTER COLUMN "resolved_at" TYPE timestamptz;`);
      await this.datasource.query(`ALTER TABLE "subscription" ALTER COLUMN "startDate" TYPE timestamptz;`);
      await this.datasource.query(`ALTER TABLE "subscription" ALTER COLUMN "endDate" TYPE timestamptz;`);
      await this.datasource.query(`ALTER TABLE "subscription" ALTER COLUMN "createdAt" TYPE timestamptz;`);
      await this.datasource.query(`ALTER TABLE "subscription" ALTER COLUMN "updatedAt" TYPE timestamptz;`);

      console.log("🛠️  [Migration] Step 4: User terms and obsoletes");
      await this.datasource.query(`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "acceptedTermsVersion" VARCHAR(20) DEFAULT NULL;`);
      await this.datasource.query(`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "acceptedTermsAt" TIMESTAMP DEFAULT NULL;`);
      await this.datasource.query(`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "acceptedPrivacyVersion" VARCHAR(20) DEFAULT NULL;`);
      await this.datasource.query(`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "acceptedPrivacyAt" TIMESTAMP DEFAULT NULL;`);
      await this.datasource.query(`
        DO $$ 
        BEGIN 
          BEGIN ALTER TABLE "user" DROP COLUMN "acceptedTerms"; EXCEPTION WHEN undefined_column THEN END;
          BEGIN ALTER TABLE "user" DROP COLUMN "acceptedPrivacy"; EXCEPTION WHEN undefined_column THEN END;
        END $$;
      `);

      console.log("🛠️  [Migration] Step 5: Recharge and Transactions");
      await this.datasource.query(`ALTER TABLE "recharge_requests" ADD COLUMN IF NOT EXISTS "isDuplicateWarning" BOOLEAN DEFAULT false;`);
      await this.datasource.query(`ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "daysBought" INT;`);
      await this.datasource.query(`ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "prevEndDate" TIMESTAMP;`);
      await this.datasource.query(`ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "newEndDate" TIMESTAMP;`);
      await this.datasource.query(`ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "receipt_image" TEXT;`);
      await this.datasource.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_recharge_approved_unique" ON "recharge_requests" ("bank_name", "receipt_number", "transaction_date") WHERE "status" = 'APROBADO';`);

      console.log("🛠️  [Migration] Step 6: Pricing and Orders");
      await this.datasource.query(`ALTER TABLE "price_settings" ADD COLUMN IF NOT EXISTS "motorizadoPercentage" DECIMAL(10,2) DEFAULT 80.00;`);
      await this.datasource.query(`ALTER TABLE "price_settings" ADD COLUMN IF NOT EXISTS "appPercentage" DECIMAL(10,2) DEFAULT 20.00;`);
      await this.datasource.query(`ALTER TABLE "pedido" ADD COLUMN IF NOT EXISTS "porcentaje_motorizado_aplicado" DECIMAL(10,2) DEFAULT 80.00;`);
      await this.datasource.query(`ALTER TABLE "pedido" ADD COLUMN IF NOT EXISTS "porcentaje_app_aplicado" DECIMAL(10,2) DEFAULT 20.00;`);
      await this.datasource.query(`ALTER TABLE "pedido" ADD COLUMN IF NOT EXISTS "ganancia_motorizado" DECIMAL(10,2) DEFAULT 0;`);
      await this.datasource.query(`ALTER TABLE "pedido" ADD COLUMN IF NOT EXISTS "comision_app_domicilio" DECIMAL(10,2) DEFAULT 0;`);
      await this.datasource.query(`ALTER TABLE "pedido" ADD COLUMN IF NOT EXISTS "ganancia_app_producto" DECIMAL(10,2) DEFAULT 0;`);
      await this.datasource.query(`ALTER TABLE "pedido" ADD COLUMN IF NOT EXISTS "total_precio_venta_publico" DECIMAL(10,2) DEFAULT 0;`);
      await this.datasource.query(`ALTER TABLE "pedido" ADD COLUMN IF NOT EXISTS "total_precio_app" DECIMAL(10,2) DEFAULT 0;`);
      await this.datasource.query(`ALTER TABLE "pedido" ADD COLUMN IF NOT EXISTS "total_comision_productos" DECIMAL(10,2) DEFAULT 0;`);
      await this.datasource.query(`ALTER TABLE "pedido" ADD COLUMN IF NOT EXISTS "pago_motorizado" DECIMAL(10,2) DEFAULT 0;`);
      await this.datasource.query(`ALTER TABLE "pedido" ADD COLUMN IF NOT EXISTS "comision_moto_app" DECIMAL(10,2) DEFAULT 0;`);
      await this.datasource.query(`ALTER TABLE "pedido" ADD COLUMN IF NOT EXISTS "noAssignedSince" TIMESTAMPTZ DEFAULT NULL;`);
      await this.datasource.query(`ALTER TABLE "pedido" ALTER COLUMN "noAssignedSince" TYPE TIMESTAMPTZ;`);
      await this.datasource.query(`ALTER TABLE "pedido" ALTER COLUMN "createdAt" TYPE timestamptz;`);
      await this.datasource.query(`ALTER TABLE "pedido" ALTER COLUMN "updatedAt" TYPE timestamptz;`);
      await this.datasource.query(`ALTER TABLE "pedido" ADD COLUMN IF NOT EXISTS "motorizadosExcluidos" TEXT DEFAULT '';`);
      await this.datasource.query(`ALTER TABLE "pedido" ADD COLUMN IF NOT EXISTS "transferenciaCanceladaConfirmada" BOOLEAN DEFAULT NULL;`);

      console.log("🛠️  [Migration] Step 7: Payphone and Cards");
      await this.datasource.query(`ALTER TABLE "negocio" ADD COLUMN IF NOT EXISTS "pago_tarjeta_habilitado_admin" BOOLEAN DEFAULT false;`);
      await this.datasource.query(`ALTER TABLE "negocio" ADD COLUMN IF NOT EXISTS "pago_tarjeta_activo_negocio" BOOLEAN DEFAULT false;`);
      await this.datasource.query(`ALTER TABLE "negocio" ADD COLUMN IF NOT EXISTS "payphone_store_id" VARCHAR DEFAULT NULL;`);
      await this.datasource.query(`ALTER TABLE "negocio" ADD COLUMN IF NOT EXISTS "payphone_token" TEXT DEFAULT NULL;`);
      await this.datasource.query(`ALTER TABLE "negocio" ADD COLUMN IF NOT EXISTS "porcentaje_recargo_tarjeta" DECIMAL(10,2) DEFAULT 0;`);
      await this.datasource.query(`ALTER TABLE "pedido" ADD COLUMN IF NOT EXISTS "metodoPago" VARCHAR DEFAULT 'EFECTIVO';`);
      await this.datasource.query(`ALTER TABLE "pedido" ADD COLUMN IF NOT EXISTS "estadoPago" VARCHAR DEFAULT 'PENDIENTE';`);
      await this.datasource.query(`ALTER TABLE "pedido" ADD COLUMN IF NOT EXISTS "referenciaPago" VARCHAR DEFAULT NULL;`);
      await this.datasource.query(`ALTER TABLE "pedido" ADD COLUMN IF NOT EXISTS "recargo_tarjeta" DECIMAL(10,2) DEFAULT 0;`);

      console.log("🛠️  [Migration] Step 8: Products and Wallet");
      await this.datasource.query(`ALTER TABLE "global_settings" ADD COLUMN IF NOT EXISTS "timeoutRondaMs" INT DEFAULT 60000;`);
      await this.datasource.query(`ALTER TABLE "global_settings" ADD COLUMN IF NOT EXISTS "maxRondasAsignacion" INT DEFAULT 4;`);
      await this.datasource.query(`ALTER TABLE "global_settings" ADD COLUMN IF NOT EXISTS "max_wait_time_acceptance" INT DEFAULT 10;`);
      await this.datasource.query(`ALTER TABLE "transaccion_motorizado" ADD COLUMN IF NOT EXISTS "reintegrado" BOOLEAN DEFAULT false;`);
      await this.datasource.query(`ALTER TABLE "transaccion_motorizado" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMPTZ DEFAULT NOW();`);
      await this.datasource.query(`ALTER TABLE "wallet_movements" ADD COLUMN IF NOT EXISTS "reference_id" VARCHAR(255) DEFAULT NULL;`);
      await this.datasource.query(`ALTER TABLE "producto" ADD COLUMN IF NOT EXISTS "precio_venta" DECIMAL(10,2) DEFAULT 0;`);
      await this.datasource.query(`ALTER TABLE "producto" ADD COLUMN IF NOT EXISTS "precio_app" DECIMAL(10,2) DEFAULT 0;`);
      await this.datasource.query(`ALTER TABLE "producto" ADD COLUMN IF NOT EXISTS "comision_producto" DECIMAL(10,2) DEFAULT 0;`);
      await this.datasource.query(`
        DO $$ BEGIN 
          IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='producto' AND column_name='precio') THEN
            UPDATE "producto" SET "precio_venta" = "precio", "precio_app" = COALESCE("precioParaApp", "precio"), "comision_producto" = "precio" - COALESCE("precioParaApp", "precio") WHERE "precio_venta" = 0 AND "precio_app" = 0;
          END IF;
          UPDATE "producto" SET "comision_producto" = "precio_venta" - "precio_app" WHERE "comision_producto" = 0 AND "precio_venta" != "precio_app";
        END $$;
      `);
      await this.datasource.query(`ALTER TABLE "producto_pedido" ADD COLUMN IF NOT EXISTS "precio_app" DECIMAL(10,2) DEFAULT 0;`);
      await this.datasource.query(`ALTER TABLE "producto_pedido" ADD COLUMN IF NOT EXISTS "comision_producto" DECIMAL(10,2) DEFAULT 0;`);
      await this.datasource.query(`ALTER TABLE "producto_pedido" ADD COLUMN IF NOT EXISTS "producto_nombre" VARCHAR(150) DEFAULT NULL;`);
      await this.datasource.query(`ALTER TABLE "producto_pedido" ADD COLUMN IF NOT EXISTS "producto_imagen" VARCHAR(255) DEFAULT NULL;`);

      console.log("🛠️  [Migration] Step 9: FK Rules");
      await this.datasource.query(`
        DO $FK_PP$
        DECLARE fk_pp_name TEXT;
        BEGIN
            SELECT conname INTO fk_pp_name FROM pg_constraint WHERE confrelid = 'producto'::regclass AND conrelid = 'producto_pedido'::regclass;
            IF fk_pp_name IS NOT NULL THEN EXECUTE 'ALTER TABLE producto_pedido DROP CONSTRAINT ' || quote_ident(fk_pp_name); END IF;
        END $FK_PP$;
      `);
      await this.datasource.query(`ALTER TABLE producto_pedido ADD CONSTRAINT "FK_producto_pedido_producto" FOREIGN KEY ("productoId") REFERENCES "producto"("id") ON DELETE SET NULL;`);

      console.log("🛠️  [Migration] Step 10: New Tables");
      await this.datasource.query(`
        CREATE TABLE IF NOT EXISTS "commission_log" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "prevMotorizadoPercentage" decimal(10,2) NOT NULL, "newMotorizadoPercentage" decimal(10,2) NOT NULL, "prevAppPercentage" decimal(10,2) NOT NULL, "newAppPercentage" decimal(10,2) NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "changedById" uuid, CONSTRAINT "PK_commission_log" PRIMARY KEY ("id"));
      `);
      await this.datasource.query(`
        CREATE TABLE IF NOT EXISTS "financial_closings" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "closingDate" date NOT NULL UNIQUE, "totalIncome" decimal(10,2) NOT NULL, "totalExpenses" decimal(10,2) NOT NULL, "backupFileUrl" varchar NOT NULL, "totalRechargesCount" int NOT NULL, "totalUserBalance" decimal(10,2) NOT NULL DEFAULT 0, "totalMotorizadoDebt" decimal(10,2) NOT NULL DEFAULT 0, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "closedById" uuid, CONSTRAINT "PK_financial_closings" PRIMARY KEY ("id"));
      `);
      await this.datasource.query(`
        CREATE TABLE IF NOT EXISTS "balance_negocio" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "fecha" date NOT NULL, "totalVendido" decimal(10,2) NOT NULL DEFAULT 0, "totalComisionApp" decimal(10,2) NOT NULL DEFAULT 0, "totalEfectivo" decimal(10,2) NOT NULL DEFAULT 0, "totalTransferencia" decimal(10,2) NOT NULL DEFAULT 0, "balanceFinal" decimal(10,2) NOT NULL DEFAULT 0, "estado" varchar NOT NULL DEFAULT 'PENDIENTE', "comprobanteUrl" text, "isClosed" boolean NOT NULL DEFAULT false, "closedById" uuid, "negocioId" uuid, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_balance_negocio" PRIMARY KEY ("id"));
      `);

      console.log("🛠️  [Migration] Step 11: Moderation and User updates");
      await this.datasource.query(`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "warnings_count" INT DEFAULT 0;`);
      await this.datasource.query(`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "suspension_until" TIMESTAMP DEFAULT NULL;`);
      await this.datasource.query(`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "isLoggedIn" BOOLEAN DEFAULT false;`);
      await this.datasource.query(`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "currentSessionId" VARCHAR;`);
      await this.datasource.query(`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "lastLoginIP" VARCHAR;`);
      await this.datasource.query(`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "lastLoginDate" TIMESTAMP;`);
      await this.datasource.query(`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "lastSeenAt" TIMESTAMP DEFAULT NULL;`);

      await this.datasource.query(`CREATE TABLE IF NOT EXISTS "moderation_log" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "adminId" uuid NOT NULL, "action" varchar NOT NULL, "comment" text NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "userId" uuid, "postId" uuid, "storieId" uuid, CONSTRAINT "PK_moderation_log" PRIMARY KEY ("id"));`);
      await this.datasource.query(`CREATE TABLE IF NOT EXISTS "post_report" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "reason" varchar NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "reporterId" uuid, "postId" uuid, CONSTRAINT "PK_post_report" PRIMARY KEY ("id"));`);
      await this.datasource.query(`CREATE TABLE IF NOT EXISTS "storie_report" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "reason" varchar NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "reporterId" uuid, "storieId" uuid, CONSTRAINT "PK_storie_report" PRIMARY KEY ("id"));`);
      await this.datasource.query(`ALTER TABLE "post_report" ADD COLUMN IF NOT EXISTS "status" VARCHAR DEFAULT 'PENDING';`);
      await this.datasource.query(`ALTER TABLE "storie_report" ADD COLUMN IF NOT EXISTS "status" VARCHAR DEFAULT 'PENDING';`);

      console.log("🛠️  [Migration] Step 12: Wallet Movements and Logs");
      await this.datasource.query(`CREATE TABLE IF NOT EXISTS "wallet_movements" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "motorized_id" uuid NOT NULL, "type" varchar NOT NULL, "amount" decimal(10,2) NOT NULL, "balance_after" decimal(10,2) NOT NULL DEFAULT 0, "status" varchar NOT NULL DEFAULT 'COMPLETADO', "description" varchar, "order_id" uuid, "admin_id" uuid, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_wallet_movements" PRIMARY KEY ("id"));`);
      await this.datasource.query(`ALTER TABLE "wallet_movements" ADD COLUMN IF NOT EXISTS "balance_after" decimal(10,2) DEFAULT 0;`);
      await this.datasource.query(`
        DO $$ BEGIN 
            IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_wallet_movements_motorizado') THEN ALTER TABLE "wallet_movements" ADD CONSTRAINT "FK_wallet_movements_motorizado" FOREIGN KEY ("motorized_id") REFERENCES "user_motorizado"("id") ON DELETE CASCADE; END IF;
            IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_wallet_movements_pedido') THEN ALTER TABLE "wallet_movements" DROP CONSTRAINT "FK_wallet_movements_pedido"; END IF;
            ALTER TABLE "wallet_movements" ADD CONSTRAINT "FK_wallet_movements_pedido" FOREIGN KEY ("order_id") REFERENCES "pedido"("id") ON DELETE SET NULL;
            DO $FK$ DECLARE fk_name TEXT; BEGIN SELECT conname INTO fk_name FROM pg_constraint WHERE confrelid = 'pedido'::regclass AND conrelid = 'transaccion_motorizado'::regclass; IF fk_name IS NOT NULL THEN EXECUTE 'ALTER TABLE transaccion_motorizado DROP CONSTRAINT ' || quote_ident(fk_name); END IF; END $FK$;
            ALTER TABLE transaccion_motorizado ADD CONSTRAINT "FK_transaccion_motorizado_pedido" FOREIGN KEY ("pedidoId") REFERENCES "pedido"("id") ON DELETE SET NULL;
        END $$;
      `);

      console.log("🛠️  [Migration] Step 13: Bank and Push");
      await this.datasource.query(`CREATE TABLE IF NOT EXISTS "bank_accounts" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "bank_name" varchar(100) NOT NULL, "account_type" varchar(50) NOT NULL, "account_number" varchar(50) NOT NULL, "account_holder" varchar(100) NOT NULL, "qr_image_url" text, "is_active" boolean DEFAULT true, "order" int DEFAULT 0, "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(), "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(), CONSTRAINT "PK_bank_accounts" PRIMARY KEY ("id"));`);
      await this.datasource.query(`CREATE TABLE IF NOT EXISTS "push_token" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "token" text NOT NULL UNIQUE, "deviceType" varchar(50), "userId" uuid, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_push_token" PRIMARY KEY ("id"), CONSTRAINT "FK_push_token_user" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE);`);
      await this.datasource.query(`CREATE TABLE IF NOT EXISTS "pedido_operativo_log" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "pedidoId" uuid NOT NULL, "motorizadoId" uuid, "adminId" uuid, "evento" varchar NOT NULL, "detalle" text, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_pedido_operativo_log" PRIMARY KEY ("id"));`);

      console.log("🛠️  [Migration] Step 14: Final Motorizado columns");
      await this.datasource.query(`ALTER TABLE "user_motorizado" ADD COLUMN IF NOT EXISTS "lastSeenAt" TIMESTAMP DEFAULT NULL;`);
      await this.datasource.query(`ALTER TABLE "user_motorizado" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP DEFAULT NOW();`);
      await this.datasource.query(`ALTER TABLE "user_motorizado" ADD COLUMN IF NOT EXISTS "ratingPromedio" DECIMAL(2,1) DEFAULT 0.0;`);
      await this.datasource.query(`ALTER TABLE "user_motorizado" ADD COLUMN IF NOT EXISTS "totalResenas" INT DEFAULT 0;`);

      // 2. Enum Additions (Individual calls to ensure they commit)
      const enums = [
        { type: 'user_status_enum', label: 'SUSPENDED' },
        { type: 'post_statuspost_enum', label: 'FLAGGED' },
        { type: 'post_statuspost_enum', label: 'PUBLISHED' },
        { type: 'post_statuspost_enum', label: 'HIDDEN' },
        { type: 'post_statuspost_enum', label: 'SCHEDULED' },
        { type: 'post_statuspost_enum', label: 'CANCELLED' },
        { type: 'post_statuspost_enum', label: 'FAILED' },
        { type: 'storie_statusstorie_enum', label: 'FLAGGED' },
        { type: 'storie_statusstorie_enum', label: 'PUBLISHED' },
        { type: 'storie_statusstorie_enum', label: 'HIDDEN' },
        { type: 'pedido_estado_enum', label: 'PENDIENTE_PAGO' },
        { type: 'transactions_reason_enum', label: 'CASH_RECHARGE' },
      ];

      for (const e of enums) {
        try {
          const exists = await this.datasource.query(`SELECT 1 FROM pg_enum WHERE enumlabel = '${e.label}' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = '${e.type}')`);
          if (exists.length === 0) {
            await this.datasource.query(`ALTER TYPE "${e.type}" ADD VALUE '${e.label}'`);
            console.log(`Enum value ${e.label} added to ${e.type}`);
          }
        } catch (err) {
          console.warn(`Could not add enum ${e.label} to ${e.type}:`, (err as Error).message);
        }
      }

      // 3. Data Migrations (with improved mapping)
      await this.datasource.query(`
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
      await this.datasource.query(`
        ALTER TABLE "negocio" ADD COLUMN IF NOT EXISTS "orden" INT DEFAULT 0;
      `).catch(err => console.warn("Negocio order migration failed:", err.message));

      // 5. Categoria Negocio Order Migration
      await this.datasource.query(`
        ALTER TABLE "categoria_negocio" ADD COLUMN IF NOT EXISTS "orden" INT DEFAULT 0;
        ALTER TABLE "categoria_negocio" ADD COLUMN IF NOT EXISTS "modeloBloqueado" BOOLEAN DEFAULT false;
        ALTER TABLE "categoria_negocio" ADD COLUMN IF NOT EXISTS "modeloMonetizacionDefault" VARCHAR DEFAULT NULL;
        ALTER TABLE "global_settings" ADD COLUMN IF NOT EXISTS "businessCover" JSONB;
        ALTER TABLE "categoria_negocio" ADD COLUMN IF NOT EXISTS "cover" JSONB;
      `).catch(err => console.warn("Categoria Negocio order migration failed:", err.message));

      // 6. Subcategoria Negocio Migration
      await this.datasource.query(`
        CREATE TABLE IF NOT EXISTS "subcategoria_negocio" (
          "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
          "nombre" varchar(100) NOT NULL,
          "orden" int DEFAULT 0,
          "created_at" TIMESTAMP NOT NULL DEFAULT now(),
          "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
          "categoriaId" uuid,
          CONSTRAINT "PK_subcategoria_negocio" PRIMARY KEY ("id")
        );

        DO $$ 
        BEGIN 
            IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_subcategoria_categoria') THEN
                ALTER TABLE "subcategoria_negocio" ADD CONSTRAINT "FK_subcategoria_categoria" FOREIGN KEY ("categoriaId") REFERENCES "categoria_negocio"("id") ON DELETE CASCADE;
            END IF;
        END $$;

        ALTER TABLE "negocio" ADD COLUMN IF NOT EXISTS "subcategoriaId" uuid DEFAULT NULL;

        DO $$ 
        BEGIN 
            IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_negocio_subcategoria') THEN
                ALTER TABLE "negocio" ADD CONSTRAINT "FK_negocio_subcategoria" FOREIGN KEY ("subcategoriaId") REFERENCES "subcategoria_negocio"("id") ON DELETE SET NULL;
            END IF;
        END $$;
      `).catch(err => console.warn("Subcategoria Negocio migration failed:", err.message));
    } catch (error) {
      console.log("DB Connection Error:", error);
      throw error;
    }
  }
}
