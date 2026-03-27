import { Request, Response } from "express";
import { Pedido, EstadoPedido, EstadoPago, Negocio } from "../../data";
import { PayphoneService } from "../services/payphone.service";
import { getIO } from "../../config/socket";

export class PayphoneWebhookController {
    handleWebhook = async (req: Request, res: Response) => {
        const { id: transactionId, clientTransactionId, status } = req.body;

        console.log(`🔔 [Payphone Webhook] Recibido: Transacción #${transactionId}, Pedido #${clientTransactionId}, Status: ${status}`);

        try {
            // 1. Buscar pedido
            const pedido = await Pedido.findOne({
                where: { id: clientTransactionId },
                relations: ["negocio", "cliente", "productos", "productos.producto"]
            });

            if (!pedido) {
                console.error(`❌ [Payphone Webhook] Pedido ${clientTransactionId} no encontrado`);
                return res.status(404).json({ message: "Pedido no encontrado" });
            }

            // Si ya está pagado o procesado, ignorar repetición del webhook
            if (pedido.estadoPago === EstadoPago.PAGADO) {
                return res.status(200).json({ message: "Pedido ya procesado" });
            }

            // 2. Verificar estatus real con Payphone API (Safety Check)
            // Necesitamos el token del negocio
            const negocio = pedido.negocio;
            if (!negocio?.payphone_token) {
                console.error(`❌ [Payphone Webhook] Negocio ${negocio?.id} no tiene token configurado`);
                return res.status(500).json({ message: "Configuración de negocio inválida" });
            }

            const verification = await PayphoneService.confirmPayment(transactionId, clientTransactionId, negocio.payphone_token);

            if (verification && verification.transactionStatus === "Approved") {
                // ✅ PAGO APROBADO
                pedido.estadoPago = EstadoPago.PAGADO;
                pedido.estado = EstadoPedido.PENDIENTE; // Ya puede ser visto por el negocio
                pedido.referenciaPago = transactionId.toString();
                await pedido.save();

                console.log(`✅ [Payphone Webhook] Pedido ${pedido.id} PAGADO E INICIADO`);

                // 🔔 Notificar al negocio por Socket
                const io = getIO();
                io.to(negocio.id).emit("nuevo_pedido", {
                    id: pedido.id,
                    estado: pedido.estado,
                    total: pedido.total,
                    productos: pedido.productos,
                    cliente: {
                        id: pedido.cliente.id,
                        name: pedido.cliente.name,
                        surname: pedido.cliente.surname
                    },
                    createdAt: pedido.createdAt
                });

                // 🔔 Notificar al cliente
                io.to(pedido.cliente.id).emit("pedido_actualizado", {
                    id: pedido.id,
                    estado: pedido.estado,
                    estadoPago: pedido.estadoPago
                });

                return res.status(200).json({ message: "Pago procesado correctamente" });
            } else {
                // ❌ PAGO FALLIDO O DENEGADO
                pedido.estadoPago = EstadoPago.FALLIDO;
                // No cambiamos el estado del pedido, o quizás a CANCELADO si queremos?
                // El usuario pidió: "El pedido se confirma SOLO con webhook (NO antes)"
                // Así que si falla, el pedido sigue "invisible" para el negocio (en PENDIENTE_PAGO) o fallido.
                await pedido.save();
                
                console.warn(`⚠️ [Payphone Webhook] Transacción ${transactionId} no aprobada: ${status}`);
                return res.status(200).json({ message: "Pago no aprobado" });
            }

        } catch (error) {
            console.error("❌ [Payphone Webhook Error]:", error);
            return res.status(500).json({ message: "Internal server error" });
        }
    };
}
