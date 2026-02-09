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

    async chargeSubscription(negocio: Negocio, updateOnFail: boolean = true) {
        if (!negocio.usuario) throw CustomError.internalServer("El negocio no tiene un usuario (dueño) asociado");

        const amount = Number(negocio.valorSuscripcion);
        const today = new Date();
        const prevEndDate = negocio.fechaFinSuscripcion ? new Date(negocio.fechaFinSuscripcion) : null;

        // Período de 30 días
        const newEndDate = new Date();
        newEndDate.setDate(today.getDate() + 30);

        try {
            // Intentar descontar de la wallet
            await this.walletService.subtractFromWallet(
                negocio.usuario.id,
                amount,
                `Pago de suscripción: ${negocio.nombre}`,
                TransactionReason.SUBSCRIPTION,
                {
                    daysBought: 30,
                    prevEndDate: prevEndDate || undefined,
                    newEndDate: newEndDate
                }
            );

            negocio.fechaInicioSuscripcion = today;
            negocio.fechaFinSuscripcion = newEndDate;
            negocio.fechaUltimoCobro = today;
            negocio.intentosCobro = 0;
            negocio.statusNegocio = StatusNegocio.ACTIVO;

            await negocio.save();
            return true;
        } catch (error: any) {
            if (updateOnFail) {
                // FALLO: Incrementar intentos y marcar como NO_PAGADO (Para CRON diario)
                negocio.intentosCobro += 1;
                negocio.fechaUltimoCobro = today;
                negocio.statusNegocio = StatusNegocio.NO_PAGADO;
                await negocio.save();
            }

            throw error;
        }
    }

    async payBusinessSubscription(negocioId: string, userId: string) {
        const negocio = await Negocio.findOne({
            where: { id: negocioId },
            relations: ["usuario"]
        });
        if (!negocio) throw CustomError.notFound("Negocio no encontrado");
        if (negocio.usuario.id !== userId) throw CustomError.forbiden("No tienes permiso para pagar esta suscripción");

        // Regla: Solo pagar si no está en PENDIENTE y está en NO_PAGADO
        if (negocio.statusNegocio === StatusNegocio.PENDIENTE) {
            throw CustomError.badRequest("El negocio está pendiente de aprobación. No se puede cobrar aún.");
        }

        if (negocio.statusNegocio === StatusNegocio.ACTIVO) {
            // Verificar si realmente está activo o si ya venció
            const today = new Date();
            if (negocio.fechaFinSuscripcion && new Date(negocio.fechaFinSuscripcion) > today) {
                throw CustomError.badRequest("El negocio ya tiene una suscripción activa y vigente.");
            }
        }

        // Si llegó aquí y es ACTIVO pero vencido, o si es NO_PAGADO, permitimos el pago.
        // updateOnFail = false para cobro manual (atomicidad)
        await this.chargeSubscription(negocio, false);
        return negocio;
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
