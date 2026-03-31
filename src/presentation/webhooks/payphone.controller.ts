import { Request, Response } from "express";
import { Pedido, EstadoPedido, EstadoPago, Negocio } from "../../data";
import { PayphoneService } from "../services/payphone.service";
import { getIO } from "../../config/socket";

export class PayphoneWebhookController {
    handleWebhook = async (req: Request, res: Response) => {
        const { id: transactionId, clientTransactionId, status } = req.body;

        console.log(`🔔 [Payphone Webhook] Recibido: Transacción #${transactionId}, ID Cliente #${clientTransactionId}, Status: ${status}`);

        try {
            // 1. Intentar buscar si es un Pedido
            const pedido = await Pedido.findOne({
                where: { id: clientTransactionId },
                relations: ["negocio", "cliente", "productos", "productos.producto"]
            });

            if (pedido) {
                // Lógica de Pedido existente
                if (pedido.estadoPago === EstadoPago.PAGADO) {
                    return res.status(200).json({ message: "Pedido ya procesado" });
                }

                const negocio = pedido.negocio;
                if (!negocio?.payphone_token) {
                    console.error(`❌ [Payphone Webhook] Negocio ${negocio?.id} no tiene token configurado`);
                    return res.status(500).json({ message: "Configuración de negocio inválida" });
                }

                const verification = await PayphoneService.confirmPayment(transactionId, clientTransactionId, negocio.payphone_token);

                if (verification && (verification.transactionStatus === "Approved" || verification.status === "Approved")) {
                    pedido.estadoPago = EstadoPago.PAGADO;
                    pedido.estado = EstadoPedido.PENDIENTE;
                    pedido.referenciaPago = transactionId.toString();
                    await pedido.save();

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

                    io.to(pedido.cliente.id).emit("pedido_actualizado", {
                        id: pedido.id,
                        estado: pedido.estado,
                        estadoPago: pedido.estadoPago
                    });

                    return res.status(200).json({ message: "Pago de pedido procesado" });
                } else {
                    pedido.estadoPago = EstadoPago.FALLIDO;
                    await pedido.save();
                    return res.status(200).json({ message: "Pago de pedido no aprobado" });
                }
            }

            // 2. Si no es un pedido, intentar buscar si es una Recarga de Billetera
            const { WalletService } = await import("../services/postService/wallet.service");
            const walletService = new WalletService();
            
            try {
                // Buscamos si el clientTransactionId corresponde a una RechargeRequest
                const result = await walletService.confirmPayphoneRecharge(clientTransactionId, transactionId);
                
                if (result.success) {
                    console.log(`✅ [Payphone Webhook] RECARGA EXITOSA: Solicitud #${clientTransactionId}`);
                    
                    // Notificar al cliente por socket si es necesario
                    // (Opcional, el frontend puede estar escuchando cambios en la billetera)
                    
                    return res.status(200).json({ message: "Recarga procesada correctamente" });
                }
            } catch (rechargeError: any) {
                // Si confirmPayphoneRecharge lanza error (ej: no encontrado o denegado), seguimos
                console.warn(`⚠️ [Payphone Webhook] No se procesó como recarga: ${rechargeError.message}`);
            }

            console.error(`❌ [Payphone Webhook] ID ${clientTransactionId} no reconocido como pedido ni recarga`);
            return res.status(404).json({ message: "ID no reconocido" });

        } catch (error) {
            console.error("❌ [Payphone Webhook Error]:", error);
            return res.status(500).json({ message: "Internal server error" });
        }
    };
}
