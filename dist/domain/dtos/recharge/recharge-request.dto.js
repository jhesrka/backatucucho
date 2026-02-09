"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateRechargeRequestDTO = void 0;
const config_1 = require("../../../config");
class CreateRechargeRequestDTO {
    constructor(amount, bank_name, transaction_date, receipt_number, receipt_image, userId, force = false, requiresManualReview = false) {
        this.amount = amount;
        this.bank_name = bank_name;
        this.transaction_date = transaction_date;
        this.receipt_number = receipt_number;
        this.receipt_image = receipt_image;
        this.userId = userId;
        this.force = force;
        this.requiresManualReview = requiresManualReview;
    }
    static create(object) {
        const { userId, amount, bank_name, transaction_date, receipt_number, force, requiresManualReview } = object;
        const isManualReview = requiresManualReview === 'true' || requiresManualReview === true;
        const isForce = force === 'true' || force === true;
        if (!userId ||
            typeof userId !== "string" ||
            !config_1.regularExp.uuid.test(userId)) {
            return ["El ID de usuario no es válido"];
        }
        // Validación estricta solo si NO requiere revisión manual
        if (!isManualReview) {
            if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
                return ["El monto debe ser un número positivo"];
            }
            if (!bank_name ||
                typeof bank_name !== "string" ||
                bank_name.trim().length < 2) {
                return ["El nombre del banco debe tener al menos 2 caracteres"];
            }
            if (!transaction_date ||
                isNaN(new Date(transaction_date).getTime()) ||
                new Date(transaction_date) > new Date()) {
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
            new CreateRechargeRequestDTO(finalAmount, finalBank, finalDate, finalReceipt, "", userId, isForce, isManualReview),
        ];
    }
}
exports.CreateRechargeRequestDTO = CreateRechargeRequestDTO;
