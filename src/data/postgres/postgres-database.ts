import { DataSource, Transaction } from "typeorm";
import {
  Post,
  User,
  Useradmin,
  Storie,
  Like,
  Wallet,
  RechargeRequest,
  Subscription,
  FreePostTracker,
  CategoriaNegocio,
  Negocio,
  Producto,
  TipoProducto,
  ProductoPedido,
  Pedido,
  UserMotorizado,
  TransaccionMotorizado,
  BalanceNegocio,
  AdminNotification,
} from "../index";
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
      ],
      synchronize: true,
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
      console.log("database conected - Schema Sync Should run");
    } catch (error) {
      console.log("DB Connection Error:", error);
    }
  }
}
