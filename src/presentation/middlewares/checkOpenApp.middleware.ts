import { NextFunction, Request, Response } from "express";
import { GlobalSettings, Negocio, EstadoNegocio } from "../../data";

export class AppStatusMiddleware {
    static async validate(req: Request, res: Response, next: NextFunction) {
        try {
            // 1. Check Global App Status
            const settings = await GlobalSettings.findOne({ where: {} });

            if (settings && settings.app_status === 'CLOSED') {
                return res.status(400).json({ message: "La aplicación está cerrada" });
            }

            // 2. Check Business Status if negocioId is present
            const { negocioId } = req.body;
            if (negocioId) {
                const negocio = await Negocio.findOne({ where: { id: negocioId } });
                if (!negocio) {
                    return res.status(404).json({ message: "Negocio no encontrado" });
                }

                // Strict check against enum or string
                if (negocio.estadoNegocio !== EstadoNegocio.ABIERTO) {
                    return res.status(400).json({ message: "El negocio está cerrado" });
                }
            }

            next();
        } catch (error) {
            console.error("Error in AppStatusMiddleware:", error);
            res.status(500).json({ message: "Internal Server Error checking app status" });
        }
    }
}
