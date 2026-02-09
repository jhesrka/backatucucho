import { Router } from "express";
import {
  UseradminRoutes,
  UserMotorizadoRoutes,
  UserRoutes,
} from "./controller";
import { AuthRoutes } from "./auth/auth.routes";
import { PostRoutes } from "./post/router";
import { StorieRoutes } from "./stories/storie.routes";
import { LikeRoutes } from "./likes/like.routes";
import { WalletRoutes } from "./wallet/wallet.routes";
import { RechargeRoutes } from "./recharge/recharge-request.routes";
import { CategoriaRoutes } from "./categorias/categoria.routes";
import { ProductoRoutes } from "./producto/producto.routes";
import { NegocioRoutes } from "./negocios/negocio.routes";
import { TipoProductoRoutes } from "./tipoProducto/tipoProducto.routes";
import { NegocioAdminRoutes } from "./negocios/negocio-admin.routes";
import { PedidoUsuarioRoutes } from "./pedidos/pedidoUsuario.routes";
import { PedidoAdminRoutes } from "./pedidos/pedidoAdmin.routes";
import { SubscriptionRoutes } from "./controller/suscriptionController/suscription.routes";
import { PriceRoutes } from "./controller/priceController/price.routes";
import { DeliverySettingsAdminRoutes } from "./pedidos/deliverySettingsAdmin.routes";
import { ProductoAdminRoutes } from "./producto/productoAdmin.routes";
import { PedidoMotoRoutes } from "./pedidos/pedidoMoto.routes";
import { BusinessRoutes } from "./business/routes";
import { DashboardRoutes } from "./dashboard/dashboard.routes";
import { WalletRoutes as WalletAdminRoutes } from "./controller/walletController/wallet.routes";
import { AdvertisingRoutes } from "./advertising/advertising.routes";
import { UploadRoutes } from "./upload/upload.routes";

import { GlobalSettingsRoutes } from "./controller/globalSettings/global-settings.routes";


import { ReportRoutes } from "./controller/report/report.routes";
import { FinancialRoutes } from "./controller/financial/financial.routes";

export class AppRoutes {
  //cuando hay metodoos estaticos no necesitams instanciar
  static get routes(): Router {
    const router = Router();
    //AUTH
    router.use("/api/auth", AuthRoutes.routes);

    //USUARIO
    router.use("/api/user", UserRoutes.routes);
    router.use("/api/wallet", WalletRoutes.routes);
    router.use("/api/settings", GlobalSettingsRoutes.routes);
    router.use("/api/reports", ReportRoutes.routes);

    //ADMINISTRADOR
    router.use("/api/useradmin", UseradminRoutes.routes);

    //MOTORIZADOS
    router.use("/api/motorizados", UserMotorizadoRoutes.routes);

    //RECARGA
    router.use("/api/recharge", RechargeRoutes.routes);

    //POST
    router.use("/api/likes", LikeRoutes.routes);

    router.use("/api/post", PostRoutes.routes);
    router.use("/api/storie", StorieRoutes.routes);

    router.use("/api/categorias", CategoriaRoutes.routes);
    router.use("/api/negocios", NegocioRoutes.routes);
    router.use("/api/negocios/admin", NegocioAdminRoutes.routes);
    router.use("/api/productos", ProductoRoutes.routes);
    router.use("/api/productos/admin", ProductoAdminRoutes.routes);
    router.use("/api/tipoproducto", TipoProductoRoutes.routes);

    router.use("/api/pedidos-usuario", PedidoUsuarioRoutes.routes);
    router.use("/api/pedidos-admin", PedidoAdminRoutes.routes);

    // PRECIOS
    router.use("/api/price", PriceRoutes.routes);

    // SUSCRIPCIONES
    router.use("/api/subscriptions", SubscriptionRoutes.routes);


    // 👇 NUEVA RUTA: Delivery Settings (GLOBAL)
    router.use("/api/admin/delivery-settings", DeliverySettingsAdminRoutes.routes);

    // ⭐ NUEVA RUTA DE PEDIDOS PARA MOTORIZADOS
    router.use("/api/pedido-moto", PedidoMotoRoutes.routes);

    // 🏢 NUEVA RUTA: Business Dashboard
    router.use("/api/business", BusinessRoutes.routes);

    // 📊 NUEVA RUTA: Admin Dashboard Stats
    router.use("/api/admin/dashboard", DashboardRoutes.routes);

    // 💰 NUEVA RUTA: Admin Wallet Management
    router.use("/api/wallets", WalletAdminRoutes.routes);

    // 📢 NUEVA RUTA: Advertising (Email & WhatsApp)
    router.use("/api/admin/advertising", AdvertisingRoutes.routes);


    // 📂 NUEVA RUTA: Validar subida archivos
    router.use("/api/upload", UploadRoutes.routes);

    // 🧾 NUEVA RUTA: Financial Module
    router.use("/api/financial", FinancialRoutes.routes);

    return router;

  }
}
