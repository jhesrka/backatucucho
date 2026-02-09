"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppDataSource = void 0;
require("reflect-metadata");
const typeorm_1 = require("typeorm");
const config_1 = require("../../config");
const user_model_1 = require("./models/user.model");
const post_model_1 = require("./models/post.model");
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
exports.AppDataSource = new typeorm_1.DataSource({
    type: "postgres",
    host: config_1.envs.DB_HOST,
    port: config_1.envs.DB_PORT,
    username: config_1.envs.DB_USERNAME,
    password: config_1.envs.DB_PASSWORD,
    database: config_1.envs.DB_DATABASE,
    synchronize: false, // SIEMPRE FALSE EN MIGRACIONES
    logging: false,
    entities: [
        user_model_1.User, post_model_1.Post, useradmin_model_1.Useradmin, stories_model_1.Storie, like_model_1.Like, wallet_model_1.Wallet, rechargeStatus_model_1.RechargeRequest, subscriptionStatus_model_1.Subscription,
        freePostTracker_model_1.FreePostTracker, transactionType_model_1.Transaction, CategoriaNegocio_1.CategoriaNegocio, Negocio_1.Negocio, Producto_1.Producto, TipoProducto_1.TipoProducto,
        UserMotorizado_1.UserMotorizado, ProductoPedido_1.ProductoPedido, Pedido_1.Pedido, TransaccionMotorizado_1.TransaccionMotorizado, BalanceNegocio_1.BalanceNegocio,
        PriceSettings_1.PriceSettings, DeliverySettings_1.DeliverySettings, AdminNotification_1.AdminNotification, global_settings_model_1.GlobalSettings, CommissionLog_1.CommissionLog, Campaign_1.Campaign,
        CampaignLog_1.CampaignLog, FinancialClosing_1.FinancialClosing, report_model_1.Report
    ],
    migrations: ["src/data/postgres/migrations/*.ts"],
    subscribers: [],
    ssl: {
        rejectUnauthorized: false,
    },
});
