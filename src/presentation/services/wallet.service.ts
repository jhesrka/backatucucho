import { Wallet, WalletStatus } from "../../data";
import { CustomError } from "../../domain";
import { CreateWalletDTO } from "../../domain/dtos/wallet/CreateWallet.dto";
import { UserService } from "./usuario/user.service";

export class WalletService {
  constructor(private readonly userService: UserService) {}


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
}
