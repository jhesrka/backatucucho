import cron from "node-cron";
import { withRedisLock } from "../utils/cron-lock";
import { Negocio, ModoOperacionNegocio, EstadoNegocio } from "../data";
import { getIO } from "../config/socket";
import { In } from "typeorm";
import { format } from "date-fns";

export const startBusinessScheduleCron = () => {
    // Correr cada minuto
    cron.schedule("* * * * *", async () => {
        await withRedisLock("business-schedule-cron", 55, async () => {
            try {
                // Obtener hora actual en Ecuador
                const ecuadorTimeStr = new Date().toLocaleString("en-US", { timeZone: 'America/Guayaquil' });
                const ecuadorTime = new Date(ecuadorTimeStr);
                const currentTimeStr = format(ecuadorTime, "HH:mm:00");

                // Buscar todos los negocios en modo AUTO
                const negociosAuto = await Negocio.find({
                    where: { modo_operacion: ModoOperacionNegocio.AUTO }
                });

                if (negociosAuto.length === 0) return;

                const io = getIO();
                let openedCount = 0;
                let closedCount = 0;

                for (const negocio of negociosAuto) {
                    if (!negocio.hora_apertura || !negocio.hora_cierre) continue;

                    let shouldBeOpen = false;
                    
                    if (negocio.hora_apertura < negocio.hora_cierre) {
                        shouldBeOpen = currentTimeStr >= negocio.hora_apertura && currentTimeStr < negocio.hora_cierre;
                    } else {
                        // Cruza la medianoche (ej: 20:00:00 a 02:00:00)
                        shouldBeOpen = currentTimeStr >= negocio.hora_apertura || currentTimeStr < negocio.hora_cierre;
                    }

                    let stateChanged = false;

                    if (shouldBeOpen && negocio.estadoNegocio === EstadoNegocio.CERRADO) {
                        negocio.estadoNegocio = EstadoNegocio.ABIERTO;
                        stateChanged = true;
                        openedCount++;
                    } else if (!shouldBeOpen && negocio.estadoNegocio === EstadoNegocio.ABIERTO) {
                        negocio.estadoNegocio = EstadoNegocio.CERRADO;
                        stateChanged = true;
                        closedCount++;
                    }

                    if (stateChanged) {
                        await negocio.save();

                        const statusData = {
                            businessId: negocio.id,
                            newStatus: negocio.estadoNegocio,
                        };

                        io.emit("business_status_changed", statusData);
                        io.to(negocio.id).emit("business_status_changed", statusData);
                    }
                }

                if (openedCount > 0 || closedCount > 0) {
                    console.log(`[CRON BUSINESS SCHEDULE] ${openedCount} abiertos, ${closedCount} cerrados automáticamente a las ${currentTimeStr}.`);
                }

            } catch (error) {
                console.error("[CRON BUSINESS SCHEDULE] Error:", error);
            }
        });
    });
};
