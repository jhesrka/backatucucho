import { Negocio, StatusNegocio, TransactionReason } from "../../data";
import { CustomError } from "../../domain";
import { WalletService } from "./postService/wallet.service";

export class SubscriptionService {
    constructor(private readonly walletService: WalletService = new WalletService()) { }

    async processDailySubscriptions() {
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Normalizar para comparar solo fecha

        const negocios = await Negocio.find({
            where: [
                { statusNegocio: StatusNegocio.ACTIVO },
                { statusNegocio: StatusNegocio.NO_PAGADO }
            ],
            relations: ["usuario"]
        });

        const results = {
            totalProcessed: 0,
            successful: 0,
            failed: 0,
            skipped: 0
        };

        for (const negocio of negocios) {
            if (Number(negocio.valorSuscripcion) <= 0) continue;

            let shouldCharge = false;

            // 1. Caso: Nunca ha tenido suscripción (primer cobro)
            if (!negocio.fechaFinSuscripcion) {
                shouldCharge = true;
            }
            // 2. Caso: Período vencido hoy o antes
            else {
                const fechaFin = new Date(negocio.fechaFinSuscripcion);
                fechaFin.setHours(0, 0, 0, 0);

                if (today >= fechaFin) {
                    // Si ya está en NO_PAGADO, revisamos los intentos
                    if (negocio.statusNegocio === StatusNegocio.NO_PAGADO) {
                        // Solo reintentar si no ha superado los 3 intentos
                        if (negocio.intentosCobro < 3) {
                            // Solo intentar una vez al día (comparando fecha del último intento)
                            if (negocio.fechaUltimoCobro) {
                                const lastCharge = new Date(negocio.fechaUltimoCobro);
                                lastCharge.setHours(0, 0, 0, 0);
                                if (today.getTime() > lastCharge.getTime()) {
                                    shouldCharge = true;
                                }
                            } else {
                                shouldCharge = true;
                            }
                        }
                    } else {
                        // Si está ACTIVO pero ya venció, intentar cobrar renovación
                        shouldCharge = true;
                    }
                }
            }

            if (shouldCharge) {
                results.totalProcessed++;
                try {
                    await this.chargeSubscription(negocio);
                    results.successful++;
                } catch (error) {
                    console.error(`Error cobrando suscripción a negocio ${negocio.nombre}:`, error);
                    results.failed++;
                }
            } else {
                results.skipped++;
            }
        }

        return results;
    }

    async chargeSubscription(negocio: Negocio) {
        if (!negocio.usuario) throw CustomError.internalServer("Negocio sin usuario asociado");

        const amount = Number(negocio.valorSuscripcion);
        const today = new Date();

        try {
            // Intentar descontar de la wallet
            await this.walletService.subtractFromWallet(
                negocio.usuario.id,
                amount,
                `Pago de suscripción: ${negocio.nombre}`,
                TransactionReason.SUBSCRIPTION
            );

            // ÉXITO: Activar período de 30 días desde hoy
            const fechaFin = new Date();
            fechaFin.setDate(today.getDate() + 30);

            negocio.fechaInicioSuscripcion = today;
            negocio.fechaFinSuscripcion = fechaFin;
            negocio.fechaUltimoCobro = today;
            negocio.intentosCobro = 0;
            negocio.statusNegocio = StatusNegocio.ACTIVO;

            await negocio.save();
            return true;
        } catch (error: any) {
            // FALLO: Incrementar intentos y marcar como NO_PAGADO
            negocio.intentosCobro += 1;
            negocio.fechaUltimoCobro = today;
            negocio.statusNegocio = StatusNegocio.NO_PAGADO;

            await negocio.save();

            // Si el error es específicamente de saldo insuficiente, lanzamos un error claro para el Admin UI
            if (error.message && error.message.includes("insuficiente")) {
                throw CustomError.badRequest("Saldo insuficiente en la wallet del dueño para pagar la suscripción");
            }

            throw error;
        }
    }

    async forceChargeSubscription(negocioId: string) {
        const negocio = await Negocio.findOne({
            where: { id: negocioId },
            relations: ["usuario"]
        });
        if (!negocio) throw CustomError.notFound("Negocio no encontrado");

        // Regla de Oro: No permitir pagos adelantados
        if (negocio.statusNegocio === StatusNegocio.ACTIVO && negocio.fechaFinSuscripcion) {
            const today = new Date();
            const fechaFin = new Date(negocio.fechaFinSuscripcion);
            if (today < fechaFin) {
                throw CustomError.badRequest("El negocio aún tiene un período de suscripción activo. No se permiten pagos adelantados.");
            }
        }

        await this.chargeSubscription(negocio);
        return negocio;
    }
}
