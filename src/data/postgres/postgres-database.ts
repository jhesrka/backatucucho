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
import { MotorizadoTier } from "./models/MotorizadoTier";
import { MeritocracyCycleLog } from "./models/MeritocracyCycleLog";
import { TrainingVideo } from "./models/TrainingVideo";
import { TrainingCategory } from "./models/TrainingCategory";
import { MeritocracyService } from "../../presentation/services/pedidosServices/meritocracy.service";
import { CategoriaService } from "../../presentation/services/categoria.service";
import { CategoriaServicio } from "./models/CategoriaServicio";
import { SubcategoriaServicio } from "./models/SubcategoriaServicio";
import { Servicio } from "./models/Servicio";
import { AgeVerificationQuestion } from "./models/AgeVerificationQuestion";
import { PreguntaFormularioCredito } from "./models/PreguntaFormularioCredito";
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
        PedidoOperativoLog,
        MotorizadoTier,
        MeritocracyCycleLog,
        TrainingVideo,
        TrainingCategory,
        CategoriaServicio,
        SubcategoriaServicio,
        Servicio,
        AgeVerificationQuestion,
        PreguntaFormularioCredito
      ],
      synchronize: false, // PRODUCCIÓN: SIEMPRE FALSE. Usar migraciones.
      ssl: {
        rejectUnauthorized: false,
      },
      // Configuración de pool para mayor estabilidad en Neon
      extra: {
        max: 5, // Reducido para evitar agotar el límite de Neon free tier (usualmente 10)
        idleTimeoutMillis: 30000, 
        connectionTimeoutMillis: 30000, 
        keepalives: true,
      },
      // Eliminamos el forzado de timezone de sesión para que el driver pg
      // maneje todo en UTC de forma nativa y TypeORM no se confunda.
    });
  }

  async connect() {
    try {
      await this.datasource.initialize();
      console.log("✅ Database connected. Running safety checks...");

      // 0. Crear tabla de control de migraciones internas si no existe
      await this.datasource.query(`
        CREATE TABLE IF NOT EXISTS "internal_migrations" (
          "id" SERIAL PRIMARY KEY,
          "step_name" VARCHAR(100) UNIQUE NOT NULL,
          "executed_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);

      const runMigrationStep = async (name: string, query: string | (() => Promise<void>)) => {
        const alreadyRun = await this.datasource.query(`SELECT 1 FROM "internal_migrations" WHERE "step_name" = $1`, [name]);
        if (alreadyRun.length > 0) {
          // console.log(`⏩ [Safety Check] Skipping already applied: ${name}`);
          return;
        }

        console.log(`🛠️  [Safety Migration] Executing: ${name}`);
        try {
          if (typeof query === 'string') {
            await this.datasource.query(query);
          } else {
            await query();
          }
          await this.datasource.query(`INSERT INTO "internal_migrations" ("step_name") VALUES ($1)`, [name]);
        } catch (err) {
          console.error(`❌ Error in migration step ${name}:`, (err as Error).message);
        }
      };

      // 1. Core Extensions and structural changes
      await runMigrationStep("Step 1: Extensions and Post columns", `
        ALTER TABLE "post" ADD COLUMN IF NOT EXISTS "showWhatsApp" BOOLEAN DEFAULT true;
        ALTER TABLE "post" ADD COLUMN IF NOT EXISTS "showLikes" BOOLEAN DEFAULT true;
        ALTER TABLE "post" ADD COLUMN IF NOT EXISTS "contentType" VARCHAR DEFAULT 'image';
        ALTER TABLE "post" ADD COLUMN IF NOT EXISTS "videoUrl" VARCHAR DEFAULT NULL;
        ALTER TABLE "post" ADD COLUMN IF NOT EXISTS "videoPlatform" VARCHAR DEFAULT NULL;
        ALTER TABLE "post" ADD COLUMN IF NOT EXISTS "videoId" VARCHAR DEFAULT NULL;
        ALTER TABLE "post" ADD COLUMN IF NOT EXISTS "videoEmbedUrl" VARCHAR DEFAULT NULL;
        ALTER TABLE "post" ADD COLUMN IF NOT EXISTS "videoOriginalUrl" VARCHAR DEFAULT NULL;
        ALTER TABLE "post" ADD COLUMN IF NOT EXISTS "scheduledAt" TIMESTAMPTZ DEFAULT NULL;
        ALTER TABLE "post" ADD COLUMN IF NOT EXISTS "publishedAt" TIMESTAMPTZ DEFAULT NULL;
      `);

      await runMigrationStep("Step 2: Global Settings", `
        ALTER TABLE "global_settings" ADD COLUMN IF NOT EXISTS "subscriptionBasicPrice" DECIMAL(10,2) DEFAULT 5.00;
        ALTER TABLE "global_settings" ADD COLUMN IF NOT EXISTS "subscriptionBasicPromoPrice" DECIMAL(10,2);
        ALTER TABLE "global_settings" ADD COLUMN IF NOT EXISTS "subscriptionBasicDurationDays" INT DEFAULT 30;
        ALTER TABLE "global_settings" ADD COLUMN IF NOT EXISTS "rechargeRetentionDays" INT DEFAULT 60;
        ALTER TABLE "global_settings" ADD COLUMN IF NOT EXISTS "currentTermsVersion" VARCHAR(20) DEFAULT 'v1.0';
        ALTER TABLE "global_settings" ADD COLUMN IF NOT EXISTS "termsUpdatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
        ALTER TABLE "global_settings" ADD COLUMN IF NOT EXISTS "reportsRetentionDays" INT DEFAULT 30;
      `);

      await runMigrationStep("Step 3: Timestamps alignment", async () => {
        // Removed forced timezone shift to prevent 5-hour jumps
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
      });

      await runMigrationStep("Step 4: User terms and obsoletes", `
        ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "acceptedTermsVersion" VARCHAR(20) DEFAULT NULL;
        ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "acceptedTermsAt" TIMESTAMP DEFAULT NULL;
        ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "acceptedPrivacyVersion" VARCHAR(20) DEFAULT NULL;
        ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "acceptedPrivacyAt" TIMESTAMP DEFAULT NULL;
        DO $$ BEGIN 
          BEGIN ALTER TABLE "user" DROP COLUMN "acceptedTerms"; EXCEPTION WHEN undefined_column THEN END;
          BEGIN ALTER TABLE "user" DROP COLUMN "acceptedPrivacy"; EXCEPTION WHEN undefined_column THEN END;
        END $$;
      `);

      await runMigrationStep("Step 5: Recharge and Transactions", `
        ALTER TABLE "recharge_requests" ADD COLUMN IF NOT EXISTS "isDuplicateWarning" BOOLEAN DEFAULT false;
        ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "daysBought" INT;
        ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "prevEndDate" TIMESTAMP;
        ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "newEndDate" TIMESTAMP;
        ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "receipt_image" TEXT;
        CREATE UNIQUE INDEX IF NOT EXISTS "IDX_recharge_approved_unique" ON "recharge_requests" ("bank_name", "receipt_number", "transaction_date") WHERE "status" = 'APROBADO';
      `);

      await runMigrationStep("Step 6: Pricing and Orders", async () => {
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
        await this.datasource.query(`ALTER TABLE "pedido" ADD COLUMN IF NOT EXISTS "motorizadosExcluidos" TEXT DEFAULT '';`);
        await this.datasource.query(`ALTER TABLE "pedido" ADD COLUMN IF NOT EXISTS "transferenciaCanceladaConfirmada" BOOLEAN DEFAULT NULL;`);
        await this.datasource.query(`ALTER TABLE "pedido" ALTER COLUMN "createdAt" TYPE timestamptz;`);
        await this.datasource.query(`ALTER TABLE "pedido" ALTER COLUMN "updatedAt" TYPE timestamptz;`);
      });

      await runMigrationStep("Step 7: Payphone and Cards", `
        ALTER TABLE "negocio" ADD COLUMN IF NOT EXISTS "pago_tarjeta_habilitado_admin" BOOLEAN DEFAULT false;
        ALTER TABLE "negocio" ADD COLUMN IF NOT EXISTS "pago_tarjeta_activo_negocio" BOOLEAN DEFAULT false;
        ALTER TABLE "negocio" ADD COLUMN IF NOT EXISTS "payphone_store_id" VARCHAR DEFAULT NULL;
        ALTER TABLE "negocio" ADD COLUMN IF NOT EXISTS "payphone_token" TEXT DEFAULT NULL;
        ALTER TABLE "negocio" ADD COLUMN IF NOT EXISTS "porcentaje_recargo_tarjeta" DECIMAL(10,2) DEFAULT 0;
        ALTER TABLE "pedido" ADD COLUMN IF NOT EXISTS "metodoPago" VARCHAR DEFAULT 'EFECTIVO';
        ALTER TABLE "pedido" ADD COLUMN IF NOT EXISTS "estadoPago" VARCHAR DEFAULT 'PENDIENTE';
        ALTER TABLE "pedido" ADD COLUMN IF NOT EXISTS "referenciaPago" VARCHAR DEFAULT NULL;
        ALTER TABLE "pedido" ADD COLUMN IF NOT EXISTS "recargo_tarjeta" DECIMAL(10,2) DEFAULT 0;
      `);

      await runMigrationStep("Step 8: Products and Wallet Data", async () => {
        await this.datasource.query(`ALTER TABLE "global_settings" ADD COLUMN IF NOT EXISTS "timeoutRondaMs" INT DEFAULT 60000;`);
        await this.datasource.query(`ALTER TABLE "global_settings" ADD COLUMN IF NOT EXISTS "maxRondasAsignacion" INT DEFAULT 4;`);
        await this.datasource.query(`ALTER TABLE "global_settings" ADD COLUMN IF NOT EXISTS "pendingOrderTimeoutMinutes" INT DEFAULT 10;`);
        await this.datasource.query(`ALTER TABLE "global_settings" ADD COLUMN IF NOT EXISTS "acceptedOrderGraceMinutes" INT DEFAULT 10;`);
        await this.datasource.query(`ALTER TABLE "transaccion_motorizado" ADD COLUMN IF NOT EXISTS "reintegrado" BOOLEAN DEFAULT false;`);
        await this.datasource.query(`ALTER TABLE "transaccion_motorizado" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMPTZ DEFAULT NOW();`);
        await this.datasource.query(`ALTER TABLE "wallet_movements" ADD COLUMN IF NOT EXISTS "reference_id" VARCHAR(255) DEFAULT NULL;`);
        await this.datasource.query(`ALTER TABLE "producto" ADD COLUMN IF NOT EXISTS "precio_venta" DECIMAL(10,2) DEFAULT 0;`);
        await this.datasource.query(`ALTER TABLE "producto" ADD COLUMN IF NOT EXISTS "precio_app" DECIMAL(10,2) DEFAULT 0;`);
        await this.datasource.query(`ALTER TABLE "producto" ADD COLUMN IF NOT EXISTS "comision_producto" DECIMAL(10,2) DEFAULT 0;`);
        // Removed destructive product price updates

      });

      await runMigrationStep("Step 9: FK Rules", async () => {
        await this.datasource.query(`
          DO $$ DECLARE fk_pp_name TEXT; BEGIN 
            SELECT conname INTO fk_pp_name FROM pg_constraint WHERE confrelid = 'producto'::regclass AND conrelid = 'producto_pedido'::regclass LIMIT 1;
            IF fk_pp_name IS NOT NULL THEN EXECUTE 'ALTER TABLE "producto_pedido" DROP CONSTRAINT ' || quote_ident(fk_pp_name); END IF;
          END $$;
        `);
        await this.datasource.query(`ALTER TABLE "producto_pedido" ADD CONSTRAINT "FK_producto_pedido_producto" FOREIGN KEY ("productoId") REFERENCES "producto"("id") ON DELETE SET NULL;`);
      });

      await runMigrationStep("Step 10: New Tables Setup", `
        CREATE TABLE IF NOT EXISTS "commission_log" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "prevMotorizadoPercentage" decimal(10,2) NOT NULL, "newMotorizadoPercentage" decimal(10,2) NOT NULL, "prevAppPercentage" decimal(10,2) NOT NULL, "newAppPercentage" decimal(10,2) NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "changedById" uuid, CONSTRAINT "PK_commission_log" PRIMARY KEY ("id"));
        CREATE TABLE IF NOT EXISTS "financial_closings" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "closingDate" date NOT NULL UNIQUE, "totalIncome" decimal(10,2) NOT NULL, "totalExpenses" decimal(10,2) NOT NULL, "backupFileUrl" varchar NOT NULL, "totalRechargesCount" int NOT NULL, "totalUserBalance" decimal(10,2) NOT NULL DEFAULT 0, "totalMotorizadoDebt" decimal(10,2) NOT NULL DEFAULT 0, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "closedById" uuid, CONSTRAINT "PK_financial_closings" PRIMARY KEY ("id"));
        CREATE TABLE IF NOT EXISTS "balance_negocio" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "fecha" date NOT NULL, "totalVendido" decimal(10,2) NOT NULL DEFAULT 0, "totalComisionApp" decimal(10,2) NOT NULL DEFAULT 0, "totalEfectivo" decimal(10,2) NOT NULL DEFAULT 0, "totalTransferencia" decimal(10,2) NOT NULL DEFAULT 0, "balanceFinal" decimal(10,2) NOT NULL DEFAULT 0, "estado" varchar NOT NULL DEFAULT 'PENDIENTE', "comprobanteUrl" text, "isClosed" boolean NOT NULL DEFAULT false, "closedById" uuid, "negocioId" uuid, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_balance_negocio" PRIMARY KEY ("id"));
      `);

      await runMigrationStep("Step 11: Moderation Systems", `
        ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "warnings_count" INT DEFAULT 0;
        ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "suspension_until" TIMESTAMP DEFAULT NULL;
        ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "isLoggedIn" BOOLEAN DEFAULT false;
        CREATE TABLE IF NOT EXISTS "moderation_log" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "adminId" uuid NOT NULL, "action" varchar NOT NULL, "comment" text NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "userId" uuid, "postId" uuid, "storieId" uuid, CONSTRAINT "PK_moderation_log" PRIMARY KEY ("id"));
      `);

      await runMigrationStep("Step 12: Wallet and Enum Fixes", async () => {
        await this.datasource.query(`CREATE TABLE IF NOT EXISTS "wallet_movements" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "motorized_id" uuid NOT NULL, "type" varchar NOT NULL, "amount" decimal(10,2) NOT NULL, "balance_after" decimal(10,2) NOT NULL DEFAULT 0, "status" varchar NOT NULL DEFAULT 'COMPLETADO', "description" varchar, "order_id" uuid, "admin_id" uuid, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_wallet_movements" PRIMARY KEY ("id"));`);
        
        const enums = [
          { type: 'pedido_estado_enum', label: 'PENDIENTE_PAGO' },
          { type: 'pedido_estado_enum', label: 'RETORNO_PENDIENTE' },
          { type: 'pedido_estado_enum', label: 'DEVUELTO_A_LOCAL' },
        ];

        for (const e of enums) {
          try {
            const exists = await this.datasource.query(`SELECT 1 FROM pg_enum WHERE enumlabel = '${e.label}' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = '${e.type}')`);
            if (exists.length === 0) await this.datasource.query(`ALTER TYPE "${e.type}" ADD VALUE '${e.label}'`);
          } catch (err) { /* Ignorado si falla */ }
        }
      });

      await runMigrationStep("Step 16: Prep Times and Acceptance", `
        ALTER TABLE "negocio" ADD COLUMN IF NOT EXISTS "tiempoPreparacionMin" INT DEFAULT 15;
        ALTER TABLE "negocio" ADD COLUMN IF NOT EXISTS "tiempoPreparacionMax" INT DEFAULT 30;
        ALTER TABLE "negocio" ADD COLUMN IF NOT EXISTS "permiteProductosProgramados" BOOLEAN DEFAULT false;
        ALTER TABLE "pedido" ADD COLUMN IF NOT EXISTS "fecha_aceptado" TIMESTAMP DEFAULT NULL;
        ALTER TABLE "producto" ADD COLUMN IF NOT EXISTS "tipoProducto" VARCHAR DEFAULT 'NORMAL';
      `);

      await runMigrationStep("Step 17: Forensic Audit Columns", `
        ALTER TABLE "pedido_operativo_log" ADD COLUMN IF NOT EXISTS "actorTipo" VARCHAR DEFAULT NULL;
        ALTER TABLE "pedido_operativo_log" ADD COLUMN IF NOT EXISTS "actorId" UUID DEFAULT NULL;
        ALTER TABLE "pedido_operativo_log" ADD COLUMN IF NOT EXISTS "estadoAnterior" VARCHAR DEFAULT NULL;
        ALTER TABLE "pedido_operativo_log" ADD COLUMN IF NOT EXISTS "estadoNuevo" VARCHAR DEFAULT NULL;
      `);

      await runMigrationStep("Step 18: Audit Log Timestamps alignment", async () => {
        // Removed forced timezone shift
        await this.datasource.query(`ALTER TABLE "pedido_operativo_log" ALTER COLUMN "createdAt" TYPE timestamptz;`);
      });

      await runMigrationStep("Step 19: Post Soft Delete support", `
        ALTER TABLE "post" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMPTZ DEFAULT NULL;
      `);

      await runMigrationStep("Step 20: Intelligent Purge Settings", `
        ALTER TABLE "global_settings" ADD COLUMN IF NOT EXISTS "postsRetentionDays" INT DEFAULT 30;
        ALTER TABLE "global_settings" ADD COLUMN IF NOT EXISTS "paidPostsRetentionDays" INT DEFAULT 90;
        ALTER TABLE "global_settings" ADD COLUMN IF NOT EXISTS "paidPurgeInactivityMonths" INT DEFAULT 6;
        ALTER TABLE "global_settings" ADD COLUMN IF NOT EXISTS "autoPurgeEnabled" BOOLEAN DEFAULT true;
      `);

      await runMigrationStep("Step 21: Meritocracy System", async () => {
        await this.datasource.query(`
          CREATE TABLE IF NOT EXISTS "motorizado_tier" (
            "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
            "name" varchar(50) NOT NULL,
            "commissionPercentage" decimal(10,2) NOT NULL,
            "minParticipationPercentage" decimal(10,2) NOT NULL,
            "color" varchar(20) DEFAULT '#admin-primary',
            "createdAt" timestamptz DEFAULT now(),
            "updatedAt" timestamptz DEFAULT now(),
            CONSTRAINT "PK_motorizado_tier" PRIMARY KEY ("id")
          );
        `);
        await this.datasource.query(`ALTER TABLE "price_settings" ADD COLUMN IF NOT EXISTS "rankingEvaluationPeriodDays" INT DEFAULT 7;`);
        await this.datasource.query(`ALTER TABLE "price_settings" ADD COLUMN IF NOT EXISTS "lastRankingUpdate" timestamptz DEFAULT NULL;`);
        await this.datasource.query(`ALTER TABLE "user_motorizado" ADD COLUMN IF NOT EXISTS "currentTierId" uuid REFERENCES "motorizado_tier"("id") ON DELETE SET NULL;`);
        await this.datasource.query(`ALTER TABLE "user_motorizado" ADD COLUMN IF NOT EXISTS "performanceLastPeriod" json DEFAULT NULL;`);
      });

      await runMigrationStep("Step 22: Motorizado Profile Picture", `
        ALTER TABLE "user_motorizado" ADD COLUMN IF NOT EXISTS "photoperfil" VARCHAR DEFAULT NULL;
      `);

      await runMigrationStep("Step 23: Fix Pedido CreatedAt Timestamptz", async () => {
        // Removed forced timezone shift
        await this.datasource.query(`ALTER TABLE "pedido" ALTER COLUMN "createdAt" TYPE timestamptz;`);
        await this.datasource.query(`ALTER TABLE "pedido" ALTER COLUMN "updatedAt" TYPE timestamptz;`);
        await this.datasource.query(`ALTER TABLE "pedido" ALTER COLUMN "fechaInicioRonda" TYPE timestamptz;`);
        await this.datasource.query(`ALTER TABLE "pedido" ALTER COLUMN "arrival_time" TYPE timestamptz;`);
      });

      await runMigrationStep("Step 24: Meritocracy Cycle Logs Table", `
        CREATE TABLE IF NOT EXISTS "meritocracy_cycle_log" (
          "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
          "cycleStart" timestamptz NOT NULL,
          "cycleEnd" timestamptz NOT NULL,
          "executionType" varchar(20) NOT NULL,
          "status" varchar(20) NOT NULL,
          "errorMessage" text,
          "processedMotorizadosCount" int NOT NULL DEFAULT 0,
          "totalOrdersCount" int NOT NULL DEFAULT 0,
          "executedAt" timestamptz NOT NULL DEFAULT now(),
          CONSTRAINT "PK_meritocracy_cycle_log" PRIMARY KEY ("id")
        );
      `);

      await runMigrationStep("Step 25: Moderation Log Missing Columns", `
        ALTER TABLE "moderation_log" ADD COLUMN IF NOT EXISTS "userId" uuid;
        ALTER TABLE "moderation_log" ADD COLUMN IF NOT EXISTS "postId" uuid;
        ALTER TABLE "moderation_log" ADD COLUMN IF NOT EXISTS "storieId" uuid;
      `);

      await runMigrationStep("Step 26: Manual Commission", `
        ALTER TABLE "user_motorizado" ADD COLUMN IF NOT EXISTS "isManualCommission" BOOLEAN DEFAULT false;
        ALTER TABLE "user_motorizado" ADD COLUMN IF NOT EXISTS "manualCommissionPercentage" DECIMAL(5,2) DEFAULT NULL;
      `);

      await runMigrationStep("Step 27: Payment Method Limits", `
        ALTER TABLE "global_settings" ADD COLUMN IF NOT EXISTS "minEfectivo" DECIMAL(10,2) DEFAULT NULL;
        ALTER TABLE "global_settings" ADD COLUMN IF NOT EXISTS "maxEfectivo" DECIMAL(10,2) DEFAULT NULL;
        ALTER TABLE "global_settings" ADD COLUMN IF NOT EXISTS "minTransferencia" DECIMAL(10,2) DEFAULT NULL;
        ALTER TABLE "global_settings" ADD COLUMN IF NOT EXISTS "maxTransferencia" DECIMAL(10,2) DEFAULT NULL;
        ALTER TABLE "global_settings" ADD COLUMN IF NOT EXISTS "minTarjeta" DECIMAL(10,2) DEFAULT NULL;
        ALTER TABLE "global_settings" ADD COLUMN IF NOT EXISTS "maxTarjeta" DECIMAL(10,2) DEFAULT NULL;
      `);

      await runMigrationStep("Step 28: Negocio Bank Account Additions", `
        ALTER TABLE "negocio" ADD COLUMN IF NOT EXISTS "identificacionCuenta" VARCHAR(50) DEFAULT NULL;
        ALTER TABLE "negocio" ADD COLUMN IF NOT EXISTS "correoCuenta" VARCHAR(100) DEFAULT NULL;
      `);

      await runMigrationStep("Step 29: Negocio Product Publications", `
        ALTER TABLE "negocio" ADD COLUMN IF NOT EXISTS "puedePublicarProductos" BOOLEAN DEFAULT false;
        ALTER TABLE "negocio" ADD COLUMN IF NOT EXISTS "limitePublicacionesSuscripcion" INT DEFAULT 0;
        ALTER TABLE "negocio" ADD COLUMN IF NOT EXISTS "publicacionesRestantes" INT DEFAULT 0;
      `);

      await runMigrationStep("Step 30: Post Product Publications", `
        ALTER TABLE "post" ADD COLUMN IF NOT EXISTS "productoId" UUID DEFAULT NULL;
        ALTER TABLE "post" ADD COLUMN IF NOT EXISTS "precioProducto" DECIMAL(10,2) DEFAULT NULL;
        -- videoUrl y otros ya estaban en Step 1, pero por si acaso falló:
        ALTER TABLE "post" ADD COLUMN IF NOT EXISTS "videoUrl" VARCHAR DEFAULT NULL;
        ALTER TABLE "post" ADD COLUMN IF NOT EXISTS "videoPlatform" VARCHAR DEFAULT NULL;
        ALTER TABLE "post" ADD COLUMN IF NOT EXISTS "videoEmbedUrl" VARCHAR DEFAULT NULL;
      `);

      await runMigrationStep("Step 31: PushToken Motorizado", `
        ALTER TABLE "push_token" ADD COLUMN IF NOT EXISTS "motorizadoId" UUID DEFAULT NULL;
      `);

      await runMigrationStep("Step 32: Sync PublicacionesRestantes", `
        UPDATE "negocio" SET "publicacionesRestantes" = "limitePublicacionesSuscripcion" WHERE "publicacionesRestantes" = 0 AND "limitePublicacionesSuscripcion" > 0;
      `);

      await runMigrationStep("Step 33: Pedido NotaGeneral", `
        ALTER TABLE "pedido" ADD COLUMN IF NOT EXISTS "notaGeneral" TEXT DEFAULT NULL;
      `);

      await runMigrationStep("Step 34: User Services Module", async () => {
        await this.datasource.query(`
          CREATE TABLE IF NOT EXISTS "categoria_servicio" (
            "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
            "nombre" varchar(100) NOT NULL,
            "estado" varchar NOT NULL DEFAULT 'ACTIVE',
            "createdAt" timestamptz NOT NULL DEFAULT now(),
            "updatedAt" timestamptz NOT NULL DEFAULT now(),
            CONSTRAINT "PK_categoria_servicio" PRIMARY KEY ("id")
          );
        `);
        await this.datasource.query(`
          CREATE TABLE IF NOT EXISTS "subcategoria_servicio" (
            "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
            "nombre" varchar(100) NOT NULL,
            "estado" varchar NOT NULL DEFAULT 'ACTIVE',
            "categoriaId" uuid REFERENCES "categoria_servicio"("id") ON DELETE CASCADE,
            "createdAt" timestamptz NOT NULL DEFAULT now(),
            "updatedAt" timestamptz NOT NULL DEFAULT now(),
            CONSTRAINT "PK_subcategoria_servicio" PRIMARY KEY ("id")
          );
        `);
        await this.datasource.query(`
          CREATE TABLE IF NOT EXISTS "servicio" (
            "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
            "nombres" varchar(100) NOT NULL,
            "apellidos" varchar(100) NOT NULL,
            "whatsapp" varchar(50) NOT NULL,
            "descripcion" text,
            "precio" decimal(10,2),
            "statusServicio" varchar NOT NULL DEFAULT 'PENDIENTE',
            "fechaInicioSuscripcion" timestamptz,
            "fechaFinSuscripcion" timestamptz,
            "autorenovacion" boolean NOT NULL DEFAULT true,
            "userId" uuid REFERENCES "user"("id") ON DELETE CASCADE,
            "categoriaId" uuid REFERENCES "categoria_servicio"("id") ON DELETE RESTRICT,
            "subcategoriaId" uuid REFERENCES "subcategoria_servicio"("id") ON DELETE RESTRICT,
            "createdAt" timestamptz NOT NULL DEFAULT now(),
            "updatedAt" timestamptz NOT NULL DEFAULT now(),
            CONSTRAINT "PK_servicio" PRIMARY KEY ("id")
          );
        `);
        await this.datasource.query(`ALTER TABLE "global_settings" ADD COLUMN IF NOT EXISTS "servicePublicationPrice" DECIMAL(10,2) DEFAULT 5.00;`);
      });

      await runMigrationStep("Step 36: Multimedia TEXT Fix", async () => {
        await this.datasource.query(`ALTER TABLE "servicio" ALTER COLUMN "imagenServicio" TYPE TEXT;`);
        await this.datasource.query(`ALTER TABLE "servicio" ALTER COLUMN "videoUrl" TYPE TEXT;`);
      });

      await runMigrationStep("Step 37: Add icono to categoria_servicio", async () => {
        await this.datasource.query(`ALTER TABLE "categoria_servicio" ADD COLUMN IF NOT EXISTS "icono" VARCHAR(50);`);
      });

      await runMigrationStep("Step 38: Add icono to subcategoria_servicio", async () => {
        await this.datasource.query(`ALTER TABLE "subcategoria_servicio" ADD COLUMN IF NOT EXISTS "icono" VARCHAR(50);`);
      });

      await runMigrationStep("Step 39: Add isVisible to servicio", async () => {
        await this.datasource.query(`ALTER TABLE "servicio" ADD COLUMN IF NOT EXISTS "isVisible" BOOLEAN DEFAULT true;`);
      });

      await runMigrationStep("Step 40: Add orden to tipo_producto", async () => {
        await this.datasource.query(`
          ALTER TABLE "tipo_producto" 
          ADD COLUMN IF NOT EXISTS "orden" integer NOT NULL DEFAULT 9999;
        `);
      });

      await runMigrationStep("Step 41: Add orden to producto", async () => {
        // Add 'orden' column to 'producto' if it doesn't exist
        await this.datasource.query(`
          ALTER TABLE "producto" 
          ADD COLUMN IF NOT EXISTS "orden" integer NOT NULL DEFAULT 9999;
        `);
      });

      await runMigrationStep("Step 42: Add shortAppName to global_settings", async () => {
        await this.datasource.query(`
          ALTER TABLE "global_settings" 
          ADD COLUMN IF NOT EXISTS "shortAppName" varchar(20) DEFAULT NULL;
        `);
      });

      await runMigrationStep("Step 43: Add placaVehiculo to user_motorizado", async () => {
        await this.datasource.query(`
          ALTER TABLE "user_motorizado" 
          ADD COLUMN IF NOT EXISTS "placaVehiculo" varchar(20) DEFAULT NULL;
        `);
      });

      await runMigrationStep("Step 44: Credit Business Models", async () => {
        await this.datasource.query(`
          CREATE TABLE IF NOT EXISTS "pregunta_formulario_credito" (
            "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
            "pregunta" varchar(255) NOT NULL,
            "tipoRespuesta" varchar NOT NULL DEFAULT 'TEXTO',
            "opciones" jsonb,
            "esRequerida" boolean NOT NULL DEFAULT true,
            "orden" integer NOT NULL DEFAULT 0,
            "createdAt" timestamptz NOT NULL DEFAULT now(),
            "updatedAt" timestamptz NOT NULL DEFAULT now(),
            "negocioId" uuid REFERENCES "negocio"("id") ON DELETE CASCADE,
            CONSTRAINT "PK_pregunta_formulario_credito" PRIMARY KEY ("id")
          );
        `);
      });

      await runMigrationStep("Step 45: Global Settings Formulario Credito", async () => {
        await this.datasource.query(`ALTER TABLE "global_settings" ADD COLUMN IF NOT EXISTS "precioFormularioCredito" DECIMAL(10,2) DEFAULT 0.50;`);
        await this.datasource.query(`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "puedeCrearNegocioCredito" BOOLEAN DEFAULT false;`);
      });

      await runMigrationStep("Step 46: Categoria Negocio Credito", async () => {
        await this.datasource.query(`ALTER TABLE "categoria_negocio" ADD COLUMN IF NOT EXISTS "esParaCredito" BOOLEAN DEFAULT false;`);
      });

      await runMigrationStep("Step 47: Modelo Monetizacion Credito", async () => {
        try {
          const exists = await this.datasource.query(`SELECT 1 FROM pg_enum WHERE enumlabel = 'CREDITO' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'negocio_modelomonetizacion_enum')`);
          if (exists.length === 0) await this.datasource.query(`ALTER TYPE "negocio_modelomonetizacion_enum" ADD VALUE 'CREDITO'`);
        } catch (err) { /* Ignorado si falla */ }
        await this.datasource.query(`ALTER TABLE "negocio" ADD COLUMN IF NOT EXISTS "esParaCredito" BOOLEAN DEFAULT false;`);
      });

      // 2. Inicializar Meritocracia
      const meritocracy = new MeritocracyService();
      await meritocracy.ensureDefaultTiers();

      // 3. Inicializar Categorías de Negocio Base (Licorerías y Preguntas)
      const categoriaService = new CategoriaService();
      await categoriaService.seedBusinessCategories().catch(e => console.error("Error en seed de categorías:", e));

      console.log("✅ Safety check completed. All manual migrations are synced.");
    } catch (error) {
      console.log("DB Connection Error:", error);
      throw error;
    }
  }
}
