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
        ALTER TABLE "post" ADD COLUMN IF NOT EXISTS "showWhatsApp" BOOLEAN DEFAULT true;
        ALTER TABLE "post" ADD COLUMN IF NOT EXISTS "showLikes" BOOLEAN DEFAULT true;
        
        ALTER TABLE "global_settings" ADD COLUMN IF NOT EXISTS "subscriptionBasicPrice" DECIMAL(10,2) DEFAULT 5.00;
        ALTER TABLE "global_settings" ADD COLUMN IF NOT EXISTS "subscriptionBasicPromoPrice" DECIMAL(10,2);
        ALTER TABLE "global_settings" ADD COLUMN IF NOT EXISTS "subscriptionBasicDurationDays" INT DEFAULT 30;
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
        -- Removing old strict unique constraint on receipt_number if exists (guessing common name or just ensuring flow)
        -- We will just try to create the new one. Users might need to manually drop old constraint if it blocks.
        -- But since "receipt_number" unique=true was there, we really should try to drop it.
        -- Try dropping generic index name if possible or Constraint. 
        
        -- Create Partial Index for Approved Recharges
        CREATE UNIQUE INDEX IF NOT EXISTS "IDX_recharge_approved_unique" 
        ON "recharge_requests" ("bank_name", "receipt_number", "transaction_date") 
        WHERE "status" = 'APROBADO';
      `);

      console.log("Manual migrations applied/checked successfully");
    } catch (error) {
      console.log("DB Connection Error:", error);
      throw error;
    }
  }
}
