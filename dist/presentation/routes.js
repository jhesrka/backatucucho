"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppRoutes = void 0;
const express_1 = require("express");
const controller_1 = require("./controller");
const auth_routes_1 = require("./auth/auth.routes");
const router_1 = require("./post/router");
const storie_routes_1 = require("./stories/storie.routes");
const like_routes_1 = require("./likes/like.routes");
const wallet_routes_1 = require("./wallet/wallet.routes");
const recharge_request_routes_1 = require("./recharge/recharge-request.routes");
const categoria_routes_1 = require("./categorias/categoria.routes");
const producto_routes_1 = require("./producto/producto.routes");
const negocio_routes_1 = require("./negocios/negocio.routes");
const tipoProducto_routes_1 = require("./tipoProducto/tipoProducto.routes");
const negocio_admin_routes_1 = require("./negocios/negocio-admin.routes");
const pedidoUsuario_routes_1 = require("./pedidos/pedidoUsuario.routes");
const pedidoAdmin_routes_1 = require("./pedidos/pedidoAdmin.routes");
const suscription_routes_1 = require("./controller/suscriptionController/suscription.routes");
const price_routes_1 = require("./controller/priceController/price.routes");
const deliverySettingsAdmin_routes_1 = require("./pedidos/deliverySettingsAdmin.routes");
const productoAdmin_routes_1 = require("./producto/productoAdmin.routes");
const pedidoMoto_routes_1 = require("./pedidos/pedidoMoto.routes");
const routes_1 = require("./business/routes");
const dashboard_routes_1 = require("./dashboard/dashboard.routes");
const wallet_routes_2 = require("./controller/walletController/wallet.routes");
const advertising_routes_1 = require("./advertising/advertising.routes");
const upload_routes_1 = require("./upload/upload.routes");
const global_settings_routes_1 = require("./controller/globalSettings/global-settings.routes");
const report_routes_1 = require("./controller/report/report.routes");
const financial_routes_1 = require("./controller/financial/financial.routes");
class AppRoutes {
    //cuando hay metodoos estaticos no necesitams instanciar
    static get routes() {
        const router = (0, express_1.Router)();
        //AUTH
        router.use("/api/auth", auth_routes_1.AuthRoutes.routes);
        //USUARIO
        router.use("/api/user", controller_1.UserRoutes.routes);
        router.use("/api/wallet", wallet_routes_1.WalletRoutes.routes);
        router.use("/api/settings", global_settings_routes_1.GlobalSettingsRoutes.routes);
        router.use("/api/reports", report_routes_1.ReportRoutes.routes);
        //ADMINISTRADOR
        router.use("/api/useradmin", controller_1.UseradminRoutes.routes);
        //MOTORIZADOS
        router.use("/api/motorizados", controller_1.UserMotorizadoRoutes.routes);
        //RECARGA
        router.use("/api/recharge", recharge_request_routes_1.RechargeRoutes.routes);
        //POST
        router.use("/api/likes", like_routes_1.LikeRoutes.routes);
        router.use("/api/post", router_1.PostRoutes.routes);
        router.use("/api/storie", storie_routes_1.StorieRoutes.routes);
        router.use("/api/categorias", categoria_routes_1.CategoriaRoutes.routes);
        router.use("/api/negocios", negocio_routes_1.NegocioRoutes.routes);
        router.use("/api/negocios/admin", negocio_admin_routes_1.NegocioAdminRoutes.routes);
        router.use("/api/productos", producto_routes_1.ProductoRoutes.routes);
        router.use("/api/productos/admin", productoAdmin_routes_1.ProductoAdminRoutes.routes);
        router.use("/api/tipoproducto", tipoProducto_routes_1.TipoProductoRoutes.routes);
        router.use("/api/pedidos-usuario", pedidoUsuario_routes_1.PedidoUsuarioRoutes.routes);
        router.use("/api/pedidos-admin", pedidoAdmin_routes_1.PedidoAdminRoutes.routes);
        // PRECIOS
        router.use("/api/price", price_routes_1.PriceRoutes.routes);
        // SUSCRIPCIONES
        router.use("/api/subscriptions", suscription_routes_1.SubscriptionRoutes.routes);
        // 👇 NUEVA RUTA: Delivery Settings (GLOBAL)
        router.use("/api/admin/delivery-settings", deliverySettingsAdmin_routes_1.DeliverySettingsAdminRoutes.routes);
        // ⭐ NUEVA RUTA DE PEDIDOS PARA MOTORIZADOS
        router.use("/api/pedido-moto", pedidoMoto_routes_1.PedidoMotoRoutes.routes);
        // 🏢 NUEVA RUTA: Business Dashboard
        router.use("/api/business", routes_1.BusinessRoutes.routes);
        // 📊 NUEVA RUTA: Admin Dashboard Stats
        router.use("/api/admin/dashboard", dashboard_routes_1.DashboardRoutes.routes);
        // 💰 NUEVA RUTA: Admin Wallet Management
        router.use("/api/wallets", wallet_routes_2.WalletRoutes.routes);
        // 📢 NUEVA RUTA: Advertising (Email & WhatsApp)
        router.use("/api/admin/advertising", advertising_routes_1.AdvertisingRoutes.routes);
        // 📂 NUEVA RUTA: Validar subida archivos
        router.use("/api/upload", upload_routes_1.UploadRoutes.routes);
        // 🧾 NUEVA RUTA: Financial Module
        router.use("/api/financial", financial_routes_1.FinancialRoutes.routes);
        return router;
    }
}
exports.AppRoutes = AppRoutes;
