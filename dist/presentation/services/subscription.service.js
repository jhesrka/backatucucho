"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SubscriptionService = void 0;
const data_1 = require("../../data");
const domain_1 = require("../../domain");
const wallet_service_1 = require("./postService/wallet.service");
class SubscriptionService {
    constructor(walletService = new wallet_service_1.WalletService()) {
        this.walletService = walletService;
    }
    processDailySubscriptions() {
        return __awaiter(this, void 0, void 0, function* () {
            const today = new Date();
            today.setHours(23, 59, 59, 999); // Al final del día para cubrir todo el rango
            // OPTIMIZACIÓN: Solo traer negocios que necesitan atención
            // 1. Los que no tienen fecha de fin (nuevos)
            // 2. Los que ya vencieron
            const negocios = yield data_1.Negocio.createQueryBuilder("negocio")
                .leftJoinAndSelect("negocio.usuario", "usuario")
                .where("negocio.statusNegocio IN (:...statuses)", {
                statuses: [data_1.StatusNegocio.ACTIVO, data_1.StatusNegocio.NO_PAGADO]
            })
                .andWhere("(negocio.fechaFinSuscripcion IS NULL OR negocio.fechaFinSuscripcion <= :today)", {
                today
            })
                .getMany();
            const results = {
                totalProcessed: negocios.length,
                successful: 0,
                failed: 0,
                skipped: 0
            };
            for (const negocio of negocios) {
                if (Number(negocio.valorSuscripcion) <= 0) {
                    results.skipped++;
                    continue;
                }
                try {
                    // El método chargeSubscription ya tiene su propia lógica de reintentos e intentos de cobro
                    yield this.chargeSubscription(negocio);
                    results.successful++;
                }
                catch (error) {
                    console.error(`[Subscription] Error en negocio ${negocio.nombre}:`, error);
                    results.failed++;
                }
            }
            return results;
        });
    }
    chargeSubscription(negocio_1) {
        return __awaiter(this, arguments, void 0, function* (negocio, updateOnFail = true) {
            if (!negocio.usuario)
                throw domain_1.CustomError.internalServer("El negocio no tiene un usuario (dueño) asociado");
            const amount = Number(negocio.valorSuscripcion);
            const today = new Date();
            const prevEndDate = negocio.fechaFinSuscripcion ? new Date(negocio.fechaFinSuscripcion) : null;
            // Período de 30 días
            const newEndDate = new Date();
            newEndDate.setDate(today.getDate() + 30);
            // Formatear fechas para la descripción del movimiento
            const options = { day: '2-digit', month: 'short', year: 'numeric' };
            const periodDesc = `(${today.toLocaleDateString('es-ES', options)} - ${newEndDate.toLocaleDateString('es-ES', options)})`;
            try {
                // Intentar descontar de la wallet
                yield this.walletService.subtractFromWallet(negocio.usuario.id, amount, `Pago de suscripción: ${negocio.nombre} ${periodDesc}`, data_1.TransactionReason.SUBSCRIPTION, {
                    daysBought: 30,
                    prevEndDate: prevEndDate || undefined,
                    newEndDate: newEndDate
                });
                negocio.fechaInicioSuscripcion = today;
                negocio.fechaFinSuscripcion = newEndDate;
                negocio.fechaUltimoCobro = today;
                negocio.intentosCobro = 0;
                negocio.statusNegocio = data_1.StatusNegocio.ACTIVO;
                if (negocio.puedePublicarProductos && negocio.limitePublicacionesSuscripcion > 0) {
                    negocio.publicacionesRestantes = negocio.limitePublicacionesSuscripcion;
                }
                yield negocio.save();
                return true;
            }
            catch (error) {
                if (updateOnFail) {
                    // FALLO: Incrementar intentos y marcar como NO_PAGADO (Para CRON diario)
                    negocio.intentosCobro += 1;
                    negocio.fechaUltimoCobro = today;
                    negocio.statusNegocio = data_1.StatusNegocio.NO_PAGADO;
                    yield negocio.save();
                }
                throw error;
            }
        });
    }
    payBusinessSubscription(negocioId, userId) {
        return __awaiter(this, void 0, void 0, function* () {
            const negocio = yield data_1.Negocio.findOne({
                where: { id: negocioId },
                relations: ["usuario"]
            });
            if (!negocio)
                throw domain_1.CustomError.notFound("Negocio no encontrado");
            if (negocio.usuario.id !== userId)
                throw domain_1.CustomError.forbiden("No tienes permiso para pagar esta suscripción");
            // Regla: Solo pagar si no está en PENDIENTE y está en NO_PAGADO
            if (negocio.statusNegocio === data_1.StatusNegocio.PENDIENTE) {
                throw domain_1.CustomError.badRequest("El negocio está pendiente de aprobación. No se puede cobrar aún.");
            }
            if (negocio.statusNegocio === data_1.StatusNegocio.ACTIVO) {
                // Verificar si realmente está activo o si ya venció
                const today = new Date();
                if (negocio.fechaFinSuscripcion && new Date(negocio.fechaFinSuscripcion) > today) {
                    throw domain_1.CustomError.badRequest("El negocio ya tiene una suscripción activa y vigente.");
                }
            }
            // Si llegó aquí y es ACTIVO pero vencido, o si es NO_PAGADO, permitimos el pago.
            // updateOnFail = false para cobro manual (atomicidad)
            yield this.chargeSubscription(negocio, false);
            return negocio;
        });
    }
    forceChargeSubscription(negocioId) {
        return __awaiter(this, void 0, void 0, function* () {
            const negocio = yield data_1.Negocio.findOne({
                where: { id: negocioId },
                relations: ["usuario"]
            });
            if (!negocio)
                throw domain_1.CustomError.notFound("Negocio no encontrado");
            // Regla de Oro: No permitir pagos adelantados
            if (negocio.statusNegocio === data_1.StatusNegocio.ACTIVO && negocio.fechaFinSuscripcion) {
                const today = new Date();
                const fechaFin = new Date(negocio.fechaFinSuscripcion);
                if (today < fechaFin) {
                    throw domain_1.CustomError.badRequest("El negocio aún tiene un período de suscripción activo. No se permiten pagos adelantados.");
                }
            }
            yield this.chargeSubscription(negocio);
            return negocio;
        });
    }
}
exports.SubscriptionService = SubscriptionService;
