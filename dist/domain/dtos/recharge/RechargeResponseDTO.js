"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RechargeResponseDTO = void 0;
class RechargeResponseDTO {
    constructor(id, amount, bank_name, transaction_date, receipt_number, receipt_image, status, created_at, admin_comment, resolved_at, user) {
        this.id = id;
        this.amount = amount;
        this.bank_name = bank_name;
        this.transaction_date = transaction_date;
        this.receipt_number = receipt_number;
        this.receipt_image = receipt_image;
        this.status = status;
        this.created_at = created_at;
        this.admin_comment = admin_comment;
        this.resolved_at = resolved_at;
        this.user = user;
    }
    static fromEntity(entity) {
        const { id, amount, bank_name, transaction_date, receipt_number, receipt_image, status, created_at, admin_comment, resolved_at, user, } = entity;
        return new RechargeResponseDTO(id, amount, bank_name, new Date(transaction_date), receipt_number, receipt_image, status, new Date(created_at), admin_comment, resolved_at ? new Date(resolved_at) : null, {
            id: user.id,
            name: user.name,
            surname: user.surname,
            email: user.email,
            whatsapp: user.whatsapp,
        });
    }
}
exports.RechargeResponseDTO = RechargeResponseDTO;
