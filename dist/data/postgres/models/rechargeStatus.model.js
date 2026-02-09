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
exports.RechargeRequest = exports.StatusRecarga = void 0;
// ENTIDAD: RechargeRequest
const typeorm_1 = require("typeorm");
const user_model_1 = require("./user.model");
var StatusRecarga;
(function (StatusRecarga) {
    StatusRecarga["PENDIENTE"] = "PENDIENTE";
    StatusRecarga["APROBADO"] = "APROBADO";
    StatusRecarga["RECHAZADO"] = "RECHAZADO";
})(StatusRecarga || (exports.StatusRecarga = StatusRecarga = {}));
//"pending" | "approved" | "rejected";
let RechargeRequest = class RechargeRequest extends typeorm_1.BaseEntity {
};
exports.RechargeRequest = RechargeRequest;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)("uuid"),
    __metadata("design:type", String)
], RechargeRequest.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => user_model_1.User, (user) => user.rechargeRequests),
    __metadata("design:type", user_model_1.User)
], RechargeRequest.prototype, "user", void 0);
__decorate([
    (0, typeorm_1.Column)("decimal", { precision: 10, scale: 2, nullable: true }),
    __metadata("design:type", Object)
], RechargeRequest.prototype, "amount", void 0);
__decorate([
    (0, typeorm_1.Column)("varchar", {
        nullable: true,
    }),
    __metadata("design:type", Object)
], RechargeRequest.prototype, "bank_name", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "timestamp", nullable: true }),
    __metadata("design:type", Object)
], RechargeRequest.prototype, "transaction_date", void 0);
__decorate([
    (0, typeorm_1.Column)("varchar", {
        nullable: true,
        // unique: true  <-- Removed to use Composite Unique Index instead
    }),
    __metadata("design:type", Object)
], RechargeRequest.prototype, "receipt_number", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: false }),
    __metadata("design:type", Boolean)
], RechargeRequest.prototype, "isDuplicateWarning", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: false }),
    __metadata("design:type", Boolean)
], RechargeRequest.prototype, "requiresManualReview", void 0);
__decorate([
    (0, typeorm_1.Column)("varchar", {
        nullable: false,
    }),
    __metadata("design:type", String)
], RechargeRequest.prototype, "receipt_image", void 0);
__decorate([
    (0, typeorm_1.Column)("enum", {
        enum: StatusRecarga,
        default: StatusRecarga.PENDIENTE,
    }),
    __metadata("design:type", String)
], RechargeRequest.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({
        nullable: true,
    }),
    __metadata("design:type", String)
], RechargeRequest.prototype, "admin_comment", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ type: "timestamp" }),
    __metadata("design:type", Date)
], RechargeRequest.prototype, "created_at", void 0);
__decorate([
    (0, typeorm_1.Column)("timestamp", { nullable: true }),
    __metadata("design:type", Date)
], RechargeRequest.prototype, "resolved_at", void 0);
exports.RechargeRequest = RechargeRequest = __decorate([
    (0, typeorm_1.Entity)("recharge_requests")
], RechargeRequest);
