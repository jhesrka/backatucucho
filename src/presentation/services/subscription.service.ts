import { Negocio, StatusNegocio, TransactionReason } from "../../data";
import { CustomError } from "../../domain";
import { WalletService } from "./postService/wallet.service";

export class SubscriptionService {
    constructor(private readonly walletService: WalletService = new WalletService()) { }

    async processDailySubscriptions(currentHour: number = 2) {
        const today = new Date();
        today.setHours(23, 59, 59, 999); // Al final del día para cubrir todo el rango

        // OPTIMIZACIÓN: Solo traer negocios que necesitan atención
        // 1. Los que no tienen fecha de fin (nuevos)
        // 2. Los que ya vencieron
        const negocios = await Negocio.createQueryBuilder("negocio")
            .leftJoinAndSelect("negocio.usuario", "usuario")
            .where("negocio.statusNegocio IN (:...statuses)", { 
                statuses: [StatusNegocio.ACTIVO, StatusNegocio.NO_PAGADO] 
            })
            .andWhere("(negocio.fechaFinSuscripcion IS NULL OR negocio.fechaFinSuscripcion <= :today)", { 
                today 
            })
            .andWhere("negocio.modeloMonetizacion != 'CREDITO'")
            .andWhere("negocio.esParaCredito = false")
            .getMany();

        const results = {
            totalProcessed: 0,
            successful: 0,
            failed: 0,
            skipped: 0
        };

        for (const negocio of negocios) {
            // LÓGICA DE FRECUENCIA INTELIGENTE
            // Si no son las 2 AM y ya superó los 8 intentos (2 días), lo ignoramos hasta el ciclo de las 2 AM.
            if (currentHour !== 2 && (negocio.intentosCobro || 0) >= 8) {
                results.skipped++;
                continue;
            }

            results.totalProcessed++;

            try {
                // El método chargeSubscription ya tiene su propia lógica de reintentos e intentos de cobro
                await this.chargeSubscription(negocio);
                results.successful++;
            } catch (error) {
                console.error(`[Subscription] Error en negocio ${negocio.nombre}:`, error);
                results.failed++;
            }
        }

        return results;
    }

    async autoChargePendingSubscriptions(userId: string) {
        console.log(`[Subscription Service] Auto-disparador activado para usuario ${userId}`);
        const today = new Date();
        
        // Buscar negocios NO_PAGADO o ACTIVO pero expirados
        const negocios = await Negocio.createQueryBuilder("negocio")
            .leftJoinAndSelect("negocio.usuario", "usuario")
            .where("usuario.id = :userId", { userId })
            .andWhere("(negocio.statusNegocio = :nopagado OR (negocio.statusNegocio = :activo AND negocio.fechaFinSuscripcion <= :today))", {
                nopagado: StatusNegocio.NO_PAGADO,
                activo: StatusNegocio.ACTIVO,
                today
            })
            .andWhere("negocio.modeloMonetizacion != 'CREDITO'")
            .andWhere("negocio.esParaCredito = false")
            .getMany();

        for (const negocio of negocios) {
            try {
                console.log(`[Subscription Service] Intentando cobro al vuelo (gatillo) para negocio ${negocio.nombre}...`);
                await this.chargeSubscription(negocio, true);
                console.log(`[Subscription Service] Cobro exitoso para ${negocio.nombre}`);
            } catch (error) {
                console.warn(`[Subscription Service] Cobro al vuelo falló para negocio ${negocio.nombre} (saldo insuficiente)`);
            }
        }
    }

    async chargeSubscription(negocio: Negocio, updateOnFail: boolean = true) {
        if (!negocio.usuario) throw CustomError.internalServer("El negocio no tiene un usuario (dueño) asociado");

        const amount = Number(negocio.valorSuscripcion);
        const today = new Date();
        const prevEndDate = negocio.fechaFinSuscripcion ? new Date(negocio.fechaFinSuscripcion) : null;

        // Período de 30 días
        const newEndDate = new Date();
        newEndDate.setDate(today.getDate() + 30);

        // Formatear fechas para la descripción del movimiento
        const options: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short', year: 'numeric' };
        const periodDesc = `(${today.toLocaleDateString('es-ES', options)} - ${newEndDate.toLocaleDateString('es-ES', options)})`;

        try {
            // Intentar descontar de la wallet solo si cuesta más de $0.00
            if (amount > 0) {
                await this.walletService.subtractFromWallet(
                    negocio.usuario.id,
                    amount,
                    `Pago de suscripción: ${negocio.nombre} ${periodDesc}`,
                    TransactionReason.SUBSCRIPTION,
                    {
                        daysBought: 30,
                        prevEndDate: prevEndDate || undefined,
                        newEndDate: newEndDate
                    }
                );
            }

            negocio.fechaInicioSuscripcion = today;
            negocio.fechaFinSuscripcion = newEndDate;
            negocio.fechaUltimoCobro = today;
            negocio.intentosCobro = 0;
            negocio.statusNegocio = StatusNegocio.ACTIVO;

            if (negocio.puedePublicarProductos && negocio.limitePublicacionesSuscripcion > 0) {
                negocio.publicacionesRestantes = negocio.limitePublicacionesSuscripcion;
            }

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
