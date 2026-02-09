"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Transaction = exports.TransactionReason = exports.TransactionOrigin = void 0;
const typeorm_1 = require("typeorm");
const index_1 = require("../../index");
var TransactionOrigin;
(function (TransactionOrigin) {
    TransactionOrigin["SYSTEM"] = "SYSTEM";
    TransactionOrigin["ADMIN"] = "ADMIN";
    TransactionOrigin["USER"] = "USER";
})(TransactionOrigin || (exports.TransactionOrigin = TransactionOrigin = {}));
var TransactionReason;
(function (TransactionReason) {
    TransactionReason["RECHARGE"] = "RECHARGE";
    TransactionReason["SUBSCRIPTION"] = "SUBSCRIPTION";
    TransactionReason["ADMIN_ADJUSTMENT"] = "ADMIN_ADJUSTMENT";
    TransactionReason["REVERSAL"] = "REVERSAL";
    TransactionReason["ORDER"] = "ORDER";
    TransactionReason["REFUND"] = "REFUND";
    TransactionReason["STORIE"] = "STORIE";
    TransactionReason["WITHDRAWAL"] = "WITHDRAWAL"; // Retiro (Solicitud o Ejecución)
})(TransactionReason || (exports.TransactionReason = TransactionReason = {}));
let Transaction = class Transaction extends typeorm_1.BaseEntity {
};
exports.Transaction = Transaction;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], Transaction.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => index_1.Wallet, { onDelete: 'CASCADE' }),
    __metadata("design:type", index_1.Wallet)
], Transaction.prototype, "wallet", void 0);
__decorate([
    (0, typeorm_1.Column)('decimal', { precision: 10, scale: 2 }),
    __metadata("design:type", Number)
], Transaction.prototype, "amount", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'enum', enum: ['credit', 'debit'] }),
    __metadata("design:type", String)
], Transaction.prototype, "type", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'enum',
        enum: TransactionReason,
        default: TransactionReason.RECHARGE
    }),
    __metadata("design:type", String)
], Transaction.prototype, "reason", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'enum',
        enum: TransactionOrigin,
        default: TransactionOrigin.SYSTEM
    }),
    __metadata("design:type", String)
], Transaction.prototype, "origin", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'varchar', // Simple varchar to avoid enum issues/complexities with migration scripts in this context
        default: 'APPROVED'
    }),
    __metadata("design:type", String)
], Transaction.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)('decimal', { precision: 10, scale: 2 }),
    __metadata("design:type", Number)
], Transaction.prototype, "previousBalance", void 0);
__decorate([
    (0, typeorm_1.Column)('decimal', { precision: 10, scale: 2 }),
    __metadata("design:type", Number)
], Transaction.prototype, "resultingBalance", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', nullable: true }),
    __metadata("design:type", Object)
], Transaction.prototype, "reference", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => index_1.Useradmin, { nullable: true }),
    __metadata("design:type", Object)
], Transaction.prototype, "admin", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], Transaction.prototype, "observation", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', nullable: true }),
    __metadata("design:type", Object)
], Transaction.prototype, "daysBought", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp', nullable: true }),
    __metadata("design:type", Object)
], Transaction.prototype, "prevEndDate", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp', nullable: true }),
    __metadata("design:type", Object)
], Transaction.prototype, "newEndDate", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], Transaction.prototype, "receipt_image", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], Transaction.prototype, "created_at", void 0);
exports.Transaction = Transaction = __decorate([
    (0, typeorm_1.Entity)('transactions')
], Transaction);
