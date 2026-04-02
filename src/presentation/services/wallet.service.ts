import { BaseEntity, LessThanOrEqual, MoreThanOrEqual, Between, Not } from "typeorm";
import { Wallet, WalletStatus, Transaction, TransactionReason, TransactionOrigin, GlobalSettings, User, Status, RechargeRequest, StatusRecarga } from "../../data";
import { CustomError } from "../../domain";
import { CreateWalletDTO } from "../../domain/dtos/wallet/CreateWallet.dto";
import { UserService } from "./usuario/user.service";
import { UploadFilesCloud } from "../../config/upload-files-cloud-adapter";
import { envs } from "../../config";

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
  // ✅ Obtener transacciones de usuario (Consolidado)
  async getUserTransactions(
    userId: string,
    page = 1,
    limit = 20,
    type?: string,
    startDate?: string,
    endDate?: string
  ) {
    const wallet = await Wallet.findOne({ where: { user: { id: userId } } });
    if (!wallet) throw CustomError.notFound("Wallet no encontrada para este usuario.");

    const whereCondition: any = {
      wallet: { id: wallet.id }
    };

    if (startDate) {
      const startDateValid = startDate;
      const endDateValid = endDate || startDateValid;
      const start = new Date(startDateValid);
      start.setHours(0, 0, 0, 0);
      const end = new Date(endDateValid);
      end.setHours(23, 59, 59, 999);
      whereCondition.created_at = Between(start, end);
    }

    if (type) {
      whereCondition.type = type as any;
    }

    const [transactions, total] = await Transaction.findAndCount({
      where: whereCondition,
      order: { created_at: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
      relations: ["admin"]
    });

    const transactionsSigned = await Promise.all(transactions.map(async (tx) => {
      if (tx.receipt_image && !tx.receipt_image.startsWith('http')) {
        try {
          const signedUrl = await UploadFilesCloud.getFile({
            bucketName: envs.AWS_BUCKET_NAME,
            key: tx.receipt_image
          });
          tx.receipt_image = signedUrl;
        } catch (error) {
          console.error(`Error signing receipt for transaction ${tx.id}`, error);
        }
      }
      return tx;
    }));

    return {
      data: transactionsSigned,
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

  /**
   * 💳 Iniciar recarga con PayPhone (Tarjeta)
   */
  async initializePayphoneRecharge(userId: string, amount: number) {
    if (amount <= 0) throw CustomError.badRequest("Monto inválido");

    // 1. Obtener credenciales globales de PayPhone
    const settings = await GlobalSettings.findOne({ where: {} });
    if (!settings?.payphoneToken || !settings?.payphoneStoreId) {
      throw CustomError.badRequest("La pasarela de pago PayPhone no está configurada por el administrador.");
    }

    // 2. Crear solicitud de recarga pendiente
    const { RechargeRequest, StatusRecarga } = await import("../../data");
    const recharge = new RechargeRequest();
    recharge.user = { id: userId } as any;
    recharge.amount = amount;
    recharge.bank_name = "PayPhone (Tarjeta)";
    recharge.payment_method = "CARD";
    recharge.status = StatusRecarga.PENDIENTE;
    recharge.receipt_image = "https://pay.payphonetodoesposible.com/images/Logotipo.png"; // Placeholder
    recharge.transaction_date = new Date();
    await recharge.save();

    // 3. Crear Checkout en PayPhone
    const { PayphoneService } = await import("./payphone.service");

    try {
      console.log(`🚀 [PayPhone Recharge] Iniciando checkout: User #${userId}, Amount: ${amount}, Store: ${settings.payphoneStoreId}`);
      
      const checkout = await PayphoneService.createCheckout({
        amount,
        clientTransactionId: recharge.id,
        reference: `Recarga de Billetera - ${userId}`,
        storeId: settings.payphoneStoreId,
        token: settings.payphoneToken,
        responseUrl: `${envs.WEBSERVICE_URL_FRONT}/saldo?payment=success&rechargeId=${recharge.id}`,
        cancellationUrl: `${envs.WEBSERVICE_URL_FRONT}/saldo?payment=cancelled&rechargeId=${recharge.id}`,
      });

      console.log(`✅ [PayPhone Recharge] Checkout creado:`, checkout);

      const payphoneUrl = checkout.payWithCard || checkout.payWithPayPhone || checkout.payUrl;

      return {
        rechargeId: recharge.id,
        payphoneUrl,
      };
    } catch (error: any) {
      console.error(`❌ [PayPhone Recharge] Error al crear checkout:`, error?.response?.data || error.message);
      await recharge.remove();
      throw error;
    }
  }

  /**
   * ✅ Confirmación automática de recarga PayPhone
   */
  async confirmPayphoneRecharge(rechargeId: string, remoteId?: number) {
    const { RechargeRequest, StatusRecarga } = await import("../../data");
    const recharge = await RechargeRequest.findOne({
      where: { id: rechargeId },
      relations: ["user"]
    });

    if (!recharge) throw CustomError.notFound("Solicitud de recarga no encontrada");
    
    // Si ya está aprobado, no hay que hacer nada pero devolvemos éxito
    if (recharge.status === StatusRecarga.APROBADO) return { success: true, message: "Recarga ya procesada" };

    const settings = await GlobalSettings.findOne({ where: {} });
    if (!settings?.payphoneToken) throw CustomError.internalServer("Error de configuración PayPhone");

    const { PayphoneService } = await import("./payphone.service");
    let currentRemoteId = remoteId;

    // Si no tenemos el RemoteId (ID de transacción de PayPhone), lo buscamos por clientTxId (rechargeId)
    if (!currentRemoteId) {
      console.log(`🔍 [Wallet Service] Buscando RemoteId para recarga: ${rechargeId}`);
      const txInfo = await PayphoneService.getTransactionByClientTxId(rechargeId, settings.payphoneToken);
      if (!txInfo || !txInfo.transactionId) {
          throw CustomError.notFound("No se encontró la transacción en PayPhone. Verifique el estado en su panel de PayPhone.");
      }
      currentRemoteId = txInfo.transactionId;
    }

    // Verificar y Confirmar con PayPhone
    const verification = await PayphoneService.confirmPayment(currentRemoteId!, rechargeId, settings.payphoneToken);

    if (verification && (verification.transactionStatus === "Approved" || verification.status === "Approved")) {
      // Acreditar saldo directamente
      const wallet = await Wallet.findOne({ where: { user: { id: recharge.user.id } } });
      if (!wallet) throw CustomError.notFound("Billetera no encontrada");

      const previousBalance = Number(wallet.balance);
      const amount = Number(recharge.amount);

      wallet.balance = previousBalance + amount;
      await wallet.save();

      // Actualizar solicitud
      recharge.status = StatusRecarga.APROBADO;
      recharge.external_transaction_id = currentRemoteId!.toString();
      recharge.resolved_at = new Date();
      await recharge.save();

      // Crear registro de transacción
      const transaction = new Transaction();
      transaction.wallet = wallet;
      transaction.amount = amount;
      transaction.type = 'credit';
      transaction.status = 'APPROVED';
      transaction.reason = TransactionReason.RECHARGE;
      transaction.origin = TransactionOrigin.USER;
      transaction.previousBalance = previousBalance;
      transaction.resultingBalance = Number(wallet.balance);
      transaction.observation = "Recarga automática con PayPhone (Tarjeta)";
      transaction.reference = recharge.id;
      await transaction.save();

      return { success: true, newBalance: wallet.balance };
    } else {
      recharge.status = StatusRecarga.RECHAZADO;
      recharge.admin_comment = "Pago denegado por PayPhone";
      await recharge.save();
      throw CustomError.badRequest("El pago no fue aprobado por el banco.");
    }
  }

  /**
   * 🔍 Buscar usuario para recarga (Admin only)
   */
  async findUserForRecharge(email: string) {
    const user = await User.findOne({
      where: { email: email.toLowerCase().trim() },
      relations: ["wallet"]
    });

    if (!user) throw CustomError.notFound("Usuario no encontrado");
    if (user.status === Status.DELETED) throw CustomError.badRequest("El usuario ha sido eliminado");

    return {
      id: user.id,
      name: user.name,
      surname: user.surname,
      email: user.email,
      whatsapp: user.whatsapp,
      status: user.status,
      balance: user.wallet ? Number(user.wallet.balance) : 0
    };
  }

  /**
   * 💵 Recarga en efectivo desde Administrador
   */
  async adminCashRecharge(userId: string, amount: number, adminId: string) {
    if (amount <= 0) throw CustomError.badRequest("El monto debe ser mayor a cero");

    const wallet = await Wallet.findOne({ 
      where: { user: { id: userId } }, 
      relations: ["user"] 
    });

    if (!wallet) throw CustomError.notFound("Wallet no encontrada para este usuario");

    const previousBalance = Number(wallet.balance);
    try {
      // 1. Crear Registro en Tabla de Recargas (Para Auditoría Unificada)
      const recharge = new RechargeRequest();
      recharge.user = wallet.user;
      recharge.amount = amount;
      recharge.bank_name = 'EFECTIVO';
      recharge.payment_method = 'CASH';
      recharge.status = StatusRecarga.APROBADO;
      recharge.receipt_number = `ADMIN-${adminId.slice(0, 5)}`;
      recharge.receipt_image = 'ImgStore/cash_recharge.png'; // Placeholder
      recharge.resolved_at = new Date();
      recharge.admin_comment = "Recarga manual por administrador";
      await recharge.save();

      // 2. Actualizar Saldo
      wallet.balance = previousBalance + amount;
      await wallet.save();

      // 3. Registro Crítico de Transacción (Vinculada)
      const transaction = new Transaction();
      transaction.wallet = wallet;
      transaction.amount = amount;
      transaction.type = 'credit';
      transaction.status = 'APPROVED';
      transaction.reason = TransactionReason.CASH_RECHARGE;
      transaction.origin = TransactionOrigin.ADMIN;
      transaction.reference = recharge.id; // Vinculación
      transaction.previousBalance = previousBalance;
      transaction.resultingBalance = Number(wallet.balance);
      transaction.observation = "Recarga en efectivo realizada por Administrador";
      transaction.admin = { id: adminId } as any;
      
      await transaction.save();

      return {
        success: true,
        newBalance: wallet.balance,
        transactionId: transaction.id,
        summary: {
          user: `${wallet.user.name} ${wallet.user.surname}`,
          amount: amount,
          date: transaction.created_at,
          method: "Efectivo",
          whatsapp: wallet.user.whatsapp,
          adminId: adminId
        }
      };
    } catch (error) {
      console.error("Error en adminCashRecharge:", error);
      throw CustomError.internalServer("Error al procesar la recarga en efectivo");
    }
  }
}
