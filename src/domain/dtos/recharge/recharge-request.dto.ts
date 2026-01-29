import { regularExp } from "../../../config";

export class CreateRechargeRequestDTO {
  private constructor(
    public readonly amount: number | undefined,
    public readonly bank_name: string | undefined,
    public readonly transaction_date: Date | undefined,
    public readonly receipt_number: string | undefined,
    public readonly receipt_image: string,
    public readonly userId: string,
    public readonly force: boolean = false,
    public readonly requiresManualReview: boolean = false
  ) { }

  static create(object: {
    [key: string]: any;
  }): [string?, CreateRechargeRequestDTO?] {
    const { userId, amount, bank_name, transaction_date, receipt_number, force, requiresManualReview } =
      object;

    const isManualReview = requiresManualReview === 'true' || requiresManualReview === true;
    const isForce = force === 'true' || force === true;

    if (
      !userId ||
      typeof userId !== "string" ||
      !regularExp.uuid.test(userId)
    ) {
      return ["El ID de usuario no es válido"];
    }

    // Validación estricta solo si NO requiere revisión manual
    if (!isManualReview) {
      if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
        return ["El monto debe ser un número positivo"];
      }

      if (
        !bank_name ||
        typeof bank_name !== "string" ||
        bank_name.trim().length < 2
      ) {
        return ["El nombre del banco debe tener al menos 2 caracteres"];
      }

      if (
        !transaction_date ||
        isNaN(new Date(transaction_date).getTime()) ||
        new Date(transaction_date) > new Date()
      ) {
        return ["La fecha de transacción no es válida o es futura"];
      }

      if (!receipt_number || typeof receipt_number !== 'string' || receipt_number.trim().length < 3) {
        return ["El número de comprobante debe tener al menos 3 caracteres"];
      }
    }

    // Preparar valores (pueden ser undefined si es revisión manual)
    const finalAmount = (amount && !isNaN(Number(amount))) ? Number(amount) : undefined;
    const finalBank = (bank_name && typeof bank_name === 'string') ? bank_name.trim() : undefined;
    const finalDate = (transaction_date && !isNaN(new Date(transaction_date).getTime())) ? new Date(transaction_date) : undefined;
    const finalReceipt = (receipt_number && typeof receipt_number === 'string') ? receipt_number.trim() : undefined;

    return [
      undefined,
      new CreateRechargeRequestDTO(
        finalAmount,
        finalBank,
        finalDate,
        finalReceipt,
        "",
        userId,
        isForce,
        isManualReview
      ),
    ];
  }
}
