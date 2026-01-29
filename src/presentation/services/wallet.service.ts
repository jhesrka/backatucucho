import { Wallet, WalletStatus, Transaction, TransactionReason, TransactionOrigin } from "../../data";
import { CustomError } from "../../domain";
import { CreateWalletDTO } from "../../domain/dtos/wallet/CreateWallet.dto";
import { UserService } from "./usuario/user.service";

export class WalletService {
  constructor(private readonly userService: UserService) { }


  //USUARIO
  async findWalletByUser(userId: string) {
    const user = await this.userService.findOneUser(userId);

    const wallet = await Wallet.findOne({
      where: { user: { id: userId } },
      relations: ["user"],
    });

    if (!wallet) {
      throw CustomError.notFound("No se encontró la wallet del usuario.");
    }

    return {
      id: wallet.id,
      balance: Number(wallet.balance),
      status: wallet.status,
      created_at: wallet.created_at,
      updated_at: wallet.updated_at,
    };
  }

  //ADMINISTRADOR
  async findAllWallets() {
    const wallets = await Wallet.find({ relations: ["user"] });
    return wallets.map((wallet) => ({
      id: wallet.id,
      balance: wallet.balance,
      status: wallet.status,
      created_at: wallet.created_at,
      updated_at: wallet.updated_at,
      user: {
        id: wallet.user.id,
        name: wallet.user.name,
        surname: wallet.user.surname,
        email: wallet.user.email,
      },
    }));
  }

  async createWallet(walletData: CreateWalletDTO) {
    const user = await this.userService.findOneUser(walletData.userId);

    const existing = await Wallet.findOne({ where: { user: { id: user.id } } });
    if (existing) {
      throw CustomError.badRequest("El usuario ya tiene una wallet.");
    }

    const wallet = new Wallet();
    wallet.user = user;
    wallet.balance = walletData.balance;

    try {
      const savedWallet = await wallet.save();
      return savedWallet;
    } catch {
      throw CustomError.internalServer("Error creando la wallet.");
    }
  }
  // ✅ Restar saldo manualmente (solo si está ACTIVA)
  async subtractFromWallet(userId: string, amount: number) {
    const wallet = await Wallet.findOne({ where: { user: { id: userId } } });

    if (!wallet) {
      throw CustomError.notFound("Wallet no encontrada");
    }

    if (wallet.status === WalletStatus.BLOQUEADO) {
      throw CustomError.forbiden("Wallet bloqueada, no se puede modificar saldo");
    }

    if (wallet.balance < amount) {
      throw CustomError.badRequest("Saldo insuficiente");
    }

    wallet.balance -= amount;

    try {
      return await wallet.save();
    } catch {
      throw CustomError.internalServer("Error al actualizar el saldo de la wallet");
    }
  }


  // ✅ Obtener total de saldo de todas las billeteras
  async getTotalBalanceOfAllWallets() {
    const result = await Wallet.createQueryBuilder("wallet")
      .select("SUM(wallet.balance)", "total")
      .getRawOne();

    return { totalBalance: parseFloat(result.total || "0") };
  }

  // ✅ Contar usuarios con saldo cero
  async countWalletsWithZeroBalance() {
    const count = await Wallet.count({ where: { balance: 0 } });
    return { totalZeroBalance: count };
  }

  // ✅ Contar usuarios con saldo mayor a cero
  async countWalletsWithPositiveBalance() {
    const count = await Wallet.createQueryBuilder("wallet")
      .where("wallet.balance > 0")
      .getCount();

    return { totalPositiveBalance: count };
  }

  // ✅ Bloquear wallet (solo cambia estado, no toca saldo)
  async blockWallet(userId: string) {
    const wallet = await Wallet.findOne({ where: { user: { id: userId } } });

    if (!wallet) throw CustomError.notFound("Wallet no encontrada");

    wallet.status = WalletStatus.BLOQUEADO;
    return await wallet.save();
  }

  // ✅ Activar wallet
  async activateWallet(userId: string) {
    const wallet = await Wallet.findOne({ where: { user: { id: userId } } });

    if (!wallet) throw CustomError.notFound("Wallet no encontrada");

    wallet.status = WalletStatus.ACTIVO;
    return await wallet.save();
  }
  // ✅ Obtener transacciones de usuario
  async getUserTransactions(
    userId: string,
    page: number = 1,
    limit: number = 10,
    type?: string,
    startDate?: string,
    endDate?: string
  ) {
    const wallet = await Wallet.findOne({ where: { user: { id: userId } } });
    if (!wallet) throw CustomError.notFound("Wallet no encontrada");

    const query = Transaction.createQueryBuilder("transaction")
      .where("transaction.walletId = :walletId", { walletId: wallet.id })
      .orderBy("transaction.created_at", "DESC")
      .skip((page - 1) * limit)
      .take(limit);

    if (type) {
      query.andWhere("transaction.type = :type", { type });
    }

    if (startDate && endDate) {
      // Ajustar fechas para incluir todo el día final
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      query.andWhere("transaction.created_at BETWEEN :startDate AND :endDate", {
        startDate,
        endDate: end.toISOString(),
      });
    }

    const [transactions, total] = await query.getManyAndCount();

    return {
      data: transactions,
      pagination: {
        currentPage: Number(page),
        totalPages: Math.ceil(total / limit),
        total,
      },
    };
  }

  // ✅ Solicitar Retiro (Genera transacción PENDIENTE)
  async requestWithdrawal(userId: string, amount: number, bankInfo: string) {
    const wallet = await Wallet.findOne({ where: { user: { id: userId } } });
    if (!wallet) throw CustomError.notFound("Wallet no encontrada");

    // Validar Saldo disponible (considerando que otros retiros pendientes NO han descontado saldo fisica pero deberian descontar "disponible")
    // Para simplificar según reglas: "El saldo anterior y posterior deben mostrarse sin cambios" en 1️⃣.
    // Pero lógicamente no debería poder pedir más de lo que tiene.
    if (Number(wallet.balance) < amount) {
      throw CustomError.badRequest("Saldo insuficiente para realizar el retiro");
    }

    const transaction = new Transaction();
    transaction.wallet = wallet;
    transaction.amount = amount;
    transaction.type = 'debit';
    transaction.reason = TransactionReason.WITHDRAWAL; // Asegurar que el enum incluya WITHDRAWAL
    transaction.origin = TransactionOrigin.USER;
    transaction.status = 'PENDING';
    transaction.observation = `Solicitud de Retiro a: ${bankInfo}`;

    // VISUALIZACIÓN: No afecta saldo aún
    transaction.previousBalance = Number(wallet.balance);
    transaction.resultingBalance = Number(wallet.balance); // Sin cambios

    await transaction.save();
    return transaction;
  }
}
