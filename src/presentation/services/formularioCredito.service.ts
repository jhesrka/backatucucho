import { PreguntaFormularioCredito } from "../../data/postgres/models/PreguntaFormularioCredito";
import { Negocio } from "../../data/postgres/models/Negocio";
import { Wallet } from "../../data/postgres/models/wallet.model";
import { Transaction, TransactionReason, TransactionOrigin } from "../../data/postgres/models/transactionType.model";
import { GlobalSettings } from "../../data/postgres/models/global-settings.model";
import { LeadCredito } from "../../data/postgres/models/LeadCredito";
import { v4 as uuidv4 } from "uuid";
import { User } from "../../data/postgres/models/user.model";
import { DataSource } from "typeorm";
import { NotificationService } from "./NotificationService";

export class FormularioCreditoService {
  async obtenerPreguntas(negocioId: string) {
    const negocio = await Negocio.findOne({ where: { id: negocioId } });
    if (!negocio) throw new Error("Negocio no encontrado");

    const preguntas = await PreguntaFormularioCredito.find({
      where: { negocio: { id: negocioId } },
      order: { orden: "ASC" },
    });

    return preguntas;
  }

  async guardarPreguntas(negocioId: string, preguntasData: any[]) {
    const negocio = await Negocio.findOne({ where: { id: negocioId } });
    if (!negocio) throw new Error("Negocio no encontrado");

    // Limpiar preguntas anteriores (o actualizar, aquí simplificamos borrando e insertando)
    await PreguntaFormularioCredito.delete({ negocio: { id: negocioId } });

    const nuevasPreguntas = preguntasData.map((p: any, index: number) => {
      const pregunta = new PreguntaFormularioCredito();
      pregunta.pregunta = p.pregunta;
      pregunta.tipoRespuesta = p.tipoRespuesta || 'TEXTO';
      pregunta.opciones = p.opciones || null;
      pregunta.esRequerida = p.esRequerida !== undefined ? p.esRequerida : true;
      pregunta.orden = index;
      pregunta.negocio = negocio;
      return pregunta;
    });

    await PreguntaFormularioCredito.save(nuevasPreguntas);

    return nuevasPreguntas;
  }

  async procesarLeadCredito(negocioId: string, usuarioId: string, respuestas: any, preguntas: any, idempotencyKey: string) {
    // 0. Check idempotency
    const existingLead = await LeadCredito.findOne({ where: { idempotencyKey } });
    if (existingLead) {
      return { success: true, message: "Lead ya procesado anteriormente", leadId: existingLead.id };
    }

    // 1. Encontrar el dueño del negocio
    const negocio = await Negocio.findOne({
      where: { id: negocioId },
      relations: ["usuario"],
    });

    if (!negocio || !negocio.usuario) {
      throw new Error("Negocio o dueño no encontrado");
    }

    const usuarioCliente = await User.findOne({ where: { id: usuarioId } });
    if (!usuarioCliente) {
      throw new Error("Cliente no encontrado");
    }

    const dueñoId = negocio.usuario.id;

    // 2. Obtener la billetera del dueño
    const wallet = await Wallet.findOne({ where: { user: { id: dueñoId } } });
    if (!wallet) {
      throw new Error("El negocio no puede recibir solicitudes en este momento (Billetera no encontrada).");
    }

    // 3. Obtener el precio del lead
    const settings = await GlobalSettings.findOne({ where: {}, order: { updatedAt: "DESC" } });
    let precioLead = settings?.precioFormularioCredito || 0.50;

    // 🏆 BENEFICIO VIP: Si el dueño del negocio está exento de cobros, el costo del lead es 0
    if (negocio.usuario.beneficiosGratuitos) {
      precioLead = 0;
    }

    if (precioLead > 0 && Number(wallet.balance) < Number(precioLead)) {
      throw new Error("El negocio no puede recibir solicitudes en este momento (Fondos insuficientes).");
    }

    const previousBalance = Number(wallet.balance);
    const resultingBalance = previousBalance - Number(precioLead);

    // 4. Descontar el dinero y registrar el movimiento
    wallet.balance = resultingBalance;
    await wallet.save();

    // 💸 Crear transacción obligatoriamente (incluso si es 0, para dejar registro)
    const transaction = new Transaction();
    transaction.wallet = wallet;
    transaction.amount = Number(precioLead);
    transaction.type = "debit";
    transaction.reason = TransactionReason.LEAD_CREDITO;
    transaction.origin = TransactionOrigin.SYSTEM;
    transaction.status = "APPROVED";
    transaction.previousBalance = previousBalance;
    transaction.resultingBalance = resultingBalance;
    
    // Generar un ID para el LeadCredito para poder usarlo en la referencia
    const leadId = uuidv4();
    const shortCode = `LEAD-${leadId.split('-')[0].toUpperCase()}`;

    transaction.observation = negocio.usuario.beneficiosGratuitos 
      ? `Lead de formulario de crédito (Beneficio VIP Gratis) - Cód: ${shortCode}`
      : `Cobro por lead de formulario de crédito - Cód: ${shortCode}`;
      
    transaction.reference = shortCode;
    await transaction.save();

    const balanceMinimoRequerido = precioLead * 3;
    if (!negocio.usuario.beneficiosGratuitos && previousBalance >= balanceMinimoRequerido && resultingBalance < balanceMinimoRequerido) {
      // El saldo acaba de bajar del límite requerido, enviar notificación al dueño
      const notificationService = new NotificationService();
      await notificationService.sendPushNotification(
        dueñoId,
        "⚠️ Negocio Oculto Temporalmente",
        `Tu saldo ($${resultingBalance.toFixed(2)}) ha bajado del mínimo para créditos. Tu negocio dejará de mostrarse.`
      );
      
      // Notificar al frontend en tiempo real si el dueño está conectado
      const { getIO } = require("../../config/socket");
      getIO().to(dueñoId).emit("negocio_oculto_credito", {
        negocioId,
        mensaje: "Tu negocio se ha ocultado por saldo insuficiente para cubrir leads de crédito."
      });
    }

    // 5. Guardar el LeadCredito en la base de datos (SIN DATOS SENSIBLES)
    const lead = new LeadCredito();
    lead.id = leadId;
    lead.negocio = negocio;
    lead.usuario = usuarioCliente;
    lead.respuestas = {}; // Privacidad: Nunca guardar respuestas
    lead.preguntas = [];  // Privacidad: Nunca guardar preguntas
    lead.idempotencyKey = idempotencyKey;
    await lead.save();

    return { success: true, message: "Lead procesado exitosamente", leadId: lead.id, nuevoSaldo: resultingBalance };
  }

  async obtenerLeads(negocioId: string) {
    const leads = await LeadCredito.find({
      where: { negocio: { id: negocioId } },
      relations: ["usuario"],
      order: { createdAt: "DESC" },
    });
    return leads;
  }

  async obtenerLeadPorCodigoAuditoria(codigo: string) {
    const lead = await LeadCredito.createQueryBuilder("lead")
      .leftJoinAndSelect("lead.usuario", "usuario")
      .leftJoinAndSelect("lead.negocio", "negocio")
      .where("CAST(lead.id AS TEXT) ILIKE :codigo", { codigo: `${codigo.replace('LEAD-', '')}%` })
      .getOne();

    if (!lead) return null;

    const transaction = await Transaction.findOne({ where: { reference: codigo } });

    return {
      ...lead,
      transactionAmount: transaction?.amount || 0,
      transactionDate: transaction?.created_at || lead.createdAt,
    };
  }
  async obtenerTodosLosLeadsAuditoria(fecha: string, page: number = 1, limit: number = 10) {
    const skip = (page - 1) * limit;
    
    // Asumimos que fecha viene en formato 'YYYY-MM-DD'
    const startOfDay = new Date(`${fecha}T00:00:00.000Z`);
    const endOfDay = new Date(`${fecha}T23:59:59.999Z`);

    const [leads, total] = await LeadCredito.createQueryBuilder("lead")
      .leftJoinAndSelect("lead.usuario", "usuario")
      .leftJoinAndSelect("lead.negocio", "negocio")
      .where("lead.createdAt >= :startOfDay", { startOfDay })
      .andWhere("lead.createdAt <= :endOfDay", { endOfDay })
      .orderBy("lead.createdAt", "DESC")
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    // Buscar transacciones asociadas (optimizando para evitar N+1)
    const leadIds = leads.map(l => l.id);
    let transactions: Transaction[] = [];
    
    if (leadIds.length > 0) {
      const references = leadIds.map(id => `LEAD-${id.substring(0, 8).toUpperCase()}`);
      
      transactions = await Transaction.createQueryBuilder("tx")
        .where("tx.reference IN (:...references)", { references })
        .getMany();
    }

    const leadsConTransaccion = leads.map(lead => {
      const ref = `LEAD-${lead.id.substring(0, 8).toUpperCase()}`;
      const tx = transactions.find(t => t.reference === ref);
      return {
        ...lead,
        transactionAmount: tx?.amount || 0,
        transactionDate: tx?.created_at || lead.createdAt,
      };
    });

    return {
      data: leadsConTransaccion,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }
}
