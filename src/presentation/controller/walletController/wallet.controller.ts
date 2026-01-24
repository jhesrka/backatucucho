import { Request, Response } from "express";
import { WalletService } from "../../services/postService/wallet.service";
import { CustomError } from "../../../domain";

export class WalletController {
    constructor(private readonly walletService: WalletService = new WalletService()) { }

    /**
     * Manejo de errores centralizado
     */
    private handleError = (error: unknown, res: Response) => {
        if (error instanceof CustomError) {
            return res.status(error.statusCode).json({ message: error.message });
        }

        const message = error instanceof Error ? error.message : "Error interno de billetera";
        console.error("Wallet Error:", error);

        return res.status(500).json({
            message: `Error de Billetera: ${message}`
        });
    };

    /**
     * 💰 Obtener billetera de un usuario
     * GET /api/wallets/admin/user/:userId
     */
    getWalletByUserId = async (req: Request, res: Response) => {
        try {
            const { userId } = req.params;
            const wallet = await this.walletService.getWalletByUserId(userId);

            res.json({
                success: true,
                wallet
            });
        } catch (error) {
            this.handleError(error, res);
        }
    };

    /**
     * 📜 Obtener historial de transacciones
     * GET /api/wallets/admin/:walletId/transactions?page=1&limit=20
     */
    getTransactionHistory = async (req: Request, res: Response) => {
        try {
            const { walletId } = req.params;
            const page = parseInt(req.query.page as string) || 1;
            const limit = parseInt(req.query.limit as string) || 20;
            const startDate = req.query.startDate as string;
            const endDate = req.query.endDate as string;
            const type = req.query.type as string;

            const history = await this.walletService.getTransactionHistory(walletId, page, limit, startDate, endDate, type);

            res.json({
                success: true,
                ...history
            });
        } catch (error) {
            this.handleError(error, res);
        }
    };

    /**
     * ✏️ Ajustar saldo manualmente
     * POST /api/wallets/admin/:walletId/adjust
     * Body: { amount, masterPin, observation }
     */
    adjustBalance = async (req: Request, res: Response) => {
        try {
            const { walletId } = req.params;
            const { amount, masterPin, observation } = req.body;
            const adminId = req.body.sessionAdmin?.id;

            if (!adminId) {
                return res.status(401).json({ message: "Admin no autenticado" });
            }

            if (amount === undefined || !masterPin || !observation) {
                return res.status(400).json({
                    message: "amount, masterPin y observation son requeridos"
                });
            }

            const result = await this.walletService.adjustBalance(
                walletId,
                Number(amount),
                masterPin,
                adminId,
                observation
            );

            res.json({
                success: true,
                message: "Saldo ajustado correctamente",
                wallet: result.wallet,
                transaction: result.transaction
            });
        } catch (error) {
            this.handleError(error, res);
        }
    };

    /**
     * 🔒 Bloquear/Desbloquear billetera
     * PUT /api/wallets/admin/:walletId/toggle-status
     * Body: { masterPin }
     */
    toggleWalletStatus = async (req: Request, res: Response) => {
        try {
            const { walletId } = req.params;
            const { masterPin } = req.body;
            const adminId = req.body.sessionAdmin?.id;

            if (!adminId) {
                return res.status(401).json({ message: "Admin no autenticado" });
            }

            if (!masterPin) {
                return res.status(400).json({ message: "masterPin es requerido" });
            }

            const wallet = await this.walletService.toggleWalletStatus(
                walletId,
                masterPin,
                adminId
            );

            res.json({
                success: true,
                message: `Billetera ${wallet.status === 'ACTIVO' ? 'desbloqueada' : 'bloqueada'} correctamente`,
                wallet
            });
        } catch (error) {
            this.handleError(error, res);
        }
    };

    /**
     * 📊 Obtener estadísticas de la billetera
     * GET /api/wallets/admin/:walletId/stats
     */
    getWalletStats = async (req: Request, res: Response) => {
        try {
            const { walletId } = req.params;
            const stats = await this.walletService.getWalletStats(walletId);

            res.json({
                success: true,
                stats
            });
        } catch (error) {
            this.handleError(error, res);
        }
    };
    /**
     * 👥 Obtener lista de usuarios con billeteras (Paginado)
     * GET /api/wallets/admin/users?page=1&limit=10&term=...
     */
    getWalletUsers = async (req: Request, res: Response) => {
        try {
            const page = parseInt(req.query.page as string) || 1;
            const limit = parseInt(req.query.limit as string) || 10;
            const term = (req.query.term as string) || "";

            const result = await this.walletService.getWalletUsers(page, limit, term);

            res.json({
                success: true,
                ...result
            });
        } catch (error) {
            this.handleError(error, res);
        }
    };

    /**
     * 📈 Obtener dashboard global de billeteras
     * GET /api/wallets/admin/dashboard/stats?period=today
     */
    getGlobalDashStats = async (req: Request, res: Response) => {
        try {
            const period = (req.query.period as any) || 'today';
            const stats = await this.walletService.getGlobalWalletStats(period);

            res.json({
                success: true,
                stats
            });
        } catch (error) {
            this.handleError(error, res);
        }
    };

    /**
     * 📅 Obtener cierre diario
     * GET /api/wallets/admin/financial/closing?date=YYYY-MM-DD
     */
    getDailyClosing = async (req: Request, res: Response) => {
        try {
            const date = (req.query.date as string) || new Intl.DateTimeFormat('en-CA', {
                timeZone: 'America/Guayaquil',
                year: 'numeric',
                month: '2-digit',
                day: '2-digit'
            }).format(new Date());
            const data = await this.walletService.getDailyFinancialSummary(date);

            res.json({
                success: true,
                data
            });
        } catch (error) {
            this.handleError(error, res);
        }
    };

    /**
     * 🔒 Realizar cierre diario
     * POST /api/wallets/admin/financial/closing
     */
    closeDay = async (req: Request, res: Response) => {
        try {
            const { date, fileUrl, totalIncome, totalExpenses, totalCount } = req.body;
            const adminId = req.body.sessionAdmin?.id;

            if (!adminId) return res.status(401).json({ message: "No autorizado" });
            if (!date || !fileUrl) return res.status(400).json({ message: "Faltan datos requeridos (fecha o archivo)" });

            const result = await this.walletService.closeFinancialDay({
                date,
                totalIncome: Number(totalIncome),
                totalExpenses: Number(totalExpenses),
                fileUrl,
                adminId,
                totalCount: Number(totalCount)
            });

            res.json({
                success: true,
                message: "Día cerrado correctamente",
                result
            });
        } catch (error) {
            this.handleError(error, res);
        }
    };
}
