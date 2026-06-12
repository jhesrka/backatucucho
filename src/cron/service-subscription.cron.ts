import cron from "node-cron";
import { Servicio, StatusServicio, User, Wallet, Transaction, TransactionReason, TransactionOrigin, GlobalSettings } from "../data/postgres/models/index";

export const startServiceSubscriptionCron = () => {
    // Se ejecuta todos los días a las 3:00 AM
    cron.schedule("0 3 * * *", async () => {
        console.log("🕒 [CRON] Iniciando revisión de suscripciones de servicios...");
        try {
            const now = new Date();
            const expiredServices = await Servicio.find({
                where: {
                    statusServicio: StatusServicio.APROBADO
                    // Note: No usamos LessThan en el find porque TypeORM puede tener temas con timestamptz
                },
                relations: ["user", "user.wallet"]
            });

            // Filtramos en memoria para evitar problemas de zona horaria de TypeORM
            const toProcess = expiredServices.filter(s => s.fechaFinSuscripcion && s.fechaFinSuscripcion <= now);

            if (toProcess.length === 0) {
                console.log("✅ [CRON] No hay suscripciones de servicios expiradas para procesar.");
                return;
            }

            console.log(`🔍 [CRON] Encontradas ${toProcess.length} suscripciones de servicios expiradas.`);

            const settings = await GlobalSettings.findOne({ where: {} });
            const price = Number(settings?.servicePublicationPrice || 5.00);

            for (const servicio of toProcess) {
                try {
                    await Servicio.getRepository().manager.transaction(async (manager: any) => {
                        if (!servicio.autorenovacion) {
                            servicio.statusServicio = StatusServicio.EXPIRADO;
                            await manager.save(servicio);
                            console.log(`[CRON] Servicio ${servicio.id} expirado (autorenovación OFF).`);
                            return;
                        }

                        const wallet = servicio.user?.wallet;
                        if (!wallet) {
                            servicio.statusServicio = StatusServicio.NO_PAGADO;
                            await manager.save(servicio);
                            console.log(`[CRON] Servicio ${servicio.id} sin wallet. Marcado NO_PAGADO.`);
                            return;
                        }

                        const currentBalance = Number(wallet.balance);
                        if (currentBalance < price) {
                            servicio.statusServicio = StatusServicio.NO_PAGADO;
                            await manager.save(servicio);
                            console.log(`[CRON] Servicio ${servicio.id} sin saldo suficiente. Marcado NO_PAGADO.`);
                            return;
                        }

                        // Renovación exitosa
                        const previousBalance = currentBalance;
                        const newBalance = currentBalance - price;

                        wallet.balance = newBalance;
                        await manager.save(wallet);

                        const fechaFin = new Date();
                        fechaFin.setDate(fechaFin.getDate() + 30);

                        servicio.fechaInicioSuscripcion = new Date();
                        servicio.fechaFinSuscripcion = fechaFin;
                        await manager.save(servicio);

                        const transaction = new Transaction();
                        transaction.wallet = wallet;
                        transaction.amount = price;
                        transaction.type = "debit";
                        transaction.reason = TransactionReason.SERVICE_SUBSCRIPTION;
                        transaction.origin = TransactionOrigin.SYSTEM;
                        transaction.status = "APPROVED";
                        transaction.previousBalance = previousBalance;
                        transaction.resultingBalance = newBalance;
                        transaction.reference = servicio.id;
                        transaction.observation = "Renovación automática de publicación de servicio";
                        
                        await manager.save(transaction);
                        console.log(`[CRON] Servicio ${servicio.id} renovado exitosamente.`);
                    });
                } catch (error) {
                    console.error(`❌ [CRON] Error procesando servicio ${servicio.id}:`, error);
                }
            }

        } catch (error) {
            console.error("❌ [CRON] Error global en revisión de suscripciones de servicios:", error);
        }
    }, {
        timezone: "America/Guayaquil"
    });
};
