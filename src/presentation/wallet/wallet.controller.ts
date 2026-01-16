import { Request, Response } from "express";
import { WalletService } from "../services/wallet.service";
import { CustomError } from "../../domain";
import { CreateWalletDTO } from "../../domain/dtos/wallet/CreateWallet.dto";

export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  private handleError = (error: unknown, res: Response) => {
    if (error instanceof CustomError) {
      return res.status(error.statusCode).json({ message: error.message });
    }

    console.error("Unhandled error:", error);
    return res.status(500).json({ message: "Error inesperado del servidor" });
  };

  createWallet = async (req: Request, res: Response) => {
    const [error, createDto] = CreateWalletDTO.create(req.body);
    if (error) return res.status(422).json({ message: error });

    try {
      const wallet = await this.walletService.createWallet(createDto!);
      return res.status(201).json(wallet);
    } catch (err) {
      return this.handleError(err, res);
    }
  };

  getWalletByUserId = async (req: Request, res: Response) => {
    const { userId } = req.params;
    try {
      const wallet = await this.walletService.findWalletByUser(userId);
      return res.status(200).json(wallet);
    } catch (err) {
      return this.handleError(err, res);
    }
  };

  getAllWallets = async (_req: Request, res: Response) => {
    try {
      const wallets = await this.walletService.findAllWallets();
      return res.status(200).json(wallets);
    } catch (err) {
      return this.handleError(err, res);
    }
  };
  // ✅ Restar saldo
  subtractBalance = async (req: Request, res: Response) => {
    const { userId } = req.params;
    let { amount } = req.body;

    amount = Number(amount); // Asegúrate de que sea un número
   

    if (isNaN(amount) || amount <= 0) {
      return res.status(400).json({ message: "Monto inválido para restar" });
    }

    try {
      const result = await this.walletService.subtractFromWallet(
        userId,
        amount
      );
      return res
        .status(200)
        .json({ message: "Saldo actualizado", wallet: result });
    } catch (err) {
      return this.handleError(err, res);
    }
  };

  // ✅ Total de todas las billeteras
  getTotalBalance = async (_req: Request, res: Response) => {
    try {
      const result = await this.walletService.getTotalBalanceOfAllWallets();
      return res.status(200).json(result);
    } catch (err) {
      return this.handleError(err, res);
    }
  };

  // ✅ Usuarios con balance = 0
  getCountZeroBalance = async (_req: Request, res: Response) => {
    try {
      const result = await this.walletService.countWalletsWithZeroBalance();
      return res.status(200).json(result);
    } catch (err) {
      return this.handleError(err, res);
    }
  };

  // ✅ Usuarios con balance > 0
  getCountPositiveBalance = async (_req: Request, res: Response) => {
    try {
      const result = await this.walletService.countWalletsWithPositiveBalance();
      return res.status(200).json(result);
    } catch (err) {
      return this.handleError(err, res);
    }
  };

  // ✅ Bloquear billetera
  blockWallet = async (req: Request, res: Response) => {
    const { userId } = req.params;

    try {
      const result = await this.walletService.blockWallet(userId);
      return res
        .status(200)
        .json({ message: "Wallet bloqueada", wallet: result });
    } catch (err) {
      return this.handleError(err, res);
    }
  };

  // ✅ Activar billetera
  activateWallet = async (req: Request, res: Response) => {
    const { userId } = req.params;

    try {
      const result = await this.walletService.activateWallet(userId);
      return res
        .status(200)
        .json({ message: "Wallet activada", wallet: result });
    } catch (err) {
      return this.handleError(err, res);
    }
  };
}
