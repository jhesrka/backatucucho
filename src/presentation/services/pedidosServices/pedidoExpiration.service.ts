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

            // 2. Buscar pedidos PENDIENTES (UsamoscreatedAt para el cálculo)
            const expiredPending = await Pedido.find({
                where: {
                    estado: EstadoPedido.PENDIENTE,
                    createdAt: LessThan(expirationLimit)
                },
                relations: ["cliente", "negocio"]
            });

            // 2.2 Buscar pedidos PENDIENTE_PAGO (5 min)
            const expiredPayphone = await Pedido.find({
                where: {
                    estado: "PENDIENTE_PAGO" as any,
                    createdAt: LessThan(new Date(now.getTime() - 5 * 60000))
                },
                relations: ["cliente", "negocio"]
            });

            const expiredPedidos = [...expiredPending, ...expiredPayphone];

            if (expiredPedidos.length === 0) return;

            console.log(`🕒 [EXPIRACIÓN] Se encontraron ${expiredPedidos.length} pedidos fuera de tiempo.`);

            const expiredIds = expiredPedidos.map(p => p.id);
            const repo = Pedido.getRepository();

            // 1. Cancelar en lote en la DB (Rápido)
            await repo.createQueryBuilder()
                .update(Pedido)
                .set({ 
                    estado: EstadoPedido.CANCELADO,
                    motivoCancelacion: "Expiración automática por falta de atención"
                })
                .whereInIds(expiredIds)
                .execute();

            console.log(`✅ [EXPIRACIÓN] ${expiredIds.length} pedidos cancelados en lote.`);

            // 2. Notificar vía Socket (Opcional: Solo a los que tenemos en memoria)
            try {
                const io = getIO();
                for (const pedido of expiredPedidos) {
                    const isPayphone = pedido.estado === "PENDIENTE_PAGO" as any;
                    const msg = isPayphone ? "Tiempo de pago excedido (5 min)" : "El restaurante nunca aceptó tu pedido";
                    
                    if (pedido.cliente) {
                        io.to(pedido.cliente.id).emit("pedido_actualizado", {
                            id: pedido.id,
                            estado: EstadoPedido.CANCELADO,
                            motivoCancelacion: msg,
                            message: "Tu pedido fue cancelado automáticamente."
                        });
                    }
                    if (pedido.negocio) {
                        io.to(pedido.negocio.id).emit("pedido_cancelado", { id: pedido.id, motivoCancelacion: msg });
                    }
                }
            } catch (e: any) {
                console.warn("⚠️ [EXPIRACIÓN] No se pudo notificar por socket:", e.message);
            }

        } catch (error) {
            console.error("❌ Error en PedidoExpirationService:", error);
        }
    }
}
