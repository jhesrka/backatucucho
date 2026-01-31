
import "reflect-metadata";
import { DataSource } from "typeorm";
import { envs } from "../../config";
import { User } from "./models/user.model";
import { Post } from "./models/post.model";
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

export const AppDataSource = new DataSource({
    type: "postgres",
    host: envs.DB_HOST,
    port: envs.DB_PORT,
    username: envs.DB_USERNAME,
    password: envs.DB_PASSWORD,
    database: envs.DB_DATABASE,
    synchronize: false, // SIEMPRE FALSE EN MIGRACIONES
    logging: false,
    entities: [
        User, Post, Useradmin, Storie, Like, Wallet, RechargeRequest, Subscription,
        FreePostTracker, Transaction, CategoriaNegocio, Negocio, Producto, TipoProducto,
        UserMotorizado, ProductoPedido, Pedido, TransaccionMotorizado, BalanceNegocio,
        PriceSettings, DeliverySettings, AdminNotification, GlobalSettings, Campaign,
        CampaignLog, FinancialClosing, Report
    ],
    migrations: ["src/data/postgres/migrations/*.ts"],
    subscribers: [],
    ssl: {
        rejectUnauthorized: false,
    },
});
