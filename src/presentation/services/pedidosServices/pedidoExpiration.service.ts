import { Pedido, EstadoPedido } from "../../../data";
import { GlobalSettings } from "../../../data/postgres/models/global-settings.model";
import { getIO } from "../../../config/socket";
import { LessThan } from "typeorm";

export class PedidoExpirationService {
    static async isOrderExpired(pedido: Pedido): Promise<boolean> {
        const settings = await GlobalSettings.findOne({ where: {} });
        if (!settings) return false;

        const maxMinutes = settings.max_wait_time_acceptance || 10;
        const now = new Date();
        const expirationLimit = new Date(now.getTime() - maxMinutes * 60000);

        return pedido.createdAt < expirationLimit;
    }

    static async checkExpiredPendingOrders() {
        try {
            // 1. Obtener configuración global
            const settings = await GlobalSettings.findOne({ where: {} });
            if (!settings) return;

            const maxMinutes = settings.max_wait_time_acceptance || 10;
            const now = new Date();
            const expirationLimit = new Date(now.getTime() - maxMinutes * 60000);

            // 2. Buscar pedidos PENDIENTES que superen el tiempo límite
            // Usamos createdAt para el cálculo
            const expiredPedidos = await Pedido.find({
                where: {
                    estado: EstadoPedido.PENDIENTE,
                    createdAt: LessThan(expirationLimit)
                },
                relations: ["cliente", "negocio"]
            });

            if (expiredPedidos.length === 0) return;

            console.log(`🕒 [EXPIRACIÓN] Se encontraron ${expiredPedidos.length} pedidos sin aceptar fuera de tiempo.`);

            for (const pedido of expiredPedidos) {
                pedido.estado = EstadoPedido.CANCELADO;
                pedido.motivoCancelacion = "El restaurante nunca aceptó tu pedido";
                await pedido.save();

                // 3. Notificar vía Socket
                const io = getIO();
                
                // Al cliente
                if (pedido.cliente) {
                    io.to(pedido.cliente.id).emit("pedido_actualizado", {
                        id: pedido.id,
                        estado: pedido.estado,
                        motivoCancelacion: pedido.motivoCancelacion,
                        message: "Tu pedido fue cancelado porque el restaurante no lo aceptó a tiempo."
                    });
                }

                // Al negocio
                if (pedido.negocio) {
                    io.to(pedido.negocio.id).emit("pedido_cancelado", {
                        id: pedido.id,
                        motivoCancelacion: pedido.motivoCancelacion
                    });
                    
                    // También emitir pedido_actualizado por si acaso el dashboard lo usa
                    io.to(pedido.negocio.id).emit("pedido_actualizado", {
                        id: pedido.id,
                        estado: pedido.estado
                    });
                }

                console.log(`✅ Pedido ${pedido.id} expirado automáticamente.`);
            }

        } catch (error) {
            console.error("❌ Error en PedidoExpirationService:", error);
        }
    }
}
