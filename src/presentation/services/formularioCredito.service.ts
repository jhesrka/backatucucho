import { PreguntaFormularioCredito } from "../../data/postgres/models/PreguntaFormularioCredito";
import { Negocio } from "../../data/postgres/models/Negocio";
import { Wallet } from "../../data/postgres/models/wallet.model";
import { Transaction, TransactionReason, TransactionOrigin } from "../../data/postgres/models/transactionType.model";
import { GlobalSettings } from "../../data/postgres/models/global-settings.model";
import { DataSource } from "typeorm";

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

  async cobrarLeadAlDueño(negocioId: string) {
    // 1. Encontrar el dueño del negocio
    const negocio = await Negocio.findOne({
      where: { id: negocioId },
      relations: ["usuario"],
    });

    if (!negocio || !negocio.usuario) {
      throw new Error("Negocio o dueño no encontrado");
    }

    const dueñoId = negocio.usuario.id;

    // 2. Obtener la billetera del dueño
    const wallet = await Wallet.findOne({ where: { user: { id: dueñoId } } });
    if (!wallet) {
      throw new Error("El negocio no puede recibir solicitudes en este momento (Billetera no encontrada).");
    }

    // 3. Obtener el precio del lead
    const settings = await GlobalSettings.findOne({ order: { updatedAt: "DESC" } });
    const precioLead = settings?.precioFormularioCredito || 0.50;

    if (precioLead > 0 && Number(wallet.balance) < Number(precioLead)) {
      throw new Error("El negocio no puede recibir solicitudes en este momento (Fondos insuficientes).");
    }

    const previousBalance = Number(wallet.balance);
    const resultingBalance = previousBalance - Number(precioLead);

    // 4. Descontar el dinero y registrar el movimiento
    wallet.balance = resultingBalance;
    await wallet.save();

    if (precioLead > 0) {
      const transaction = new Transaction();
      transaction.wallet = wallet;
      transaction.amount = Number(precioLead);
      transaction.type = "debit";
      transaction.reason = TransactionReason.LEAD_CREDITO;
      transaction.origin = TransactionOrigin.SYSTEM;
      transaction.status = "APPROVED";
      transaction.previousBalance = previousBalance;
      transaction.resultingBalance = resultingBalance;
      transaction.observation = "Cobro por lead de formulario de crédito";
      transaction.reference = negocioId;
      await transaction.save();
    }

    return { success: true, message: "Lead cobrado exitosamente", nuevoSaldo: resultingBalance };
  }
}
