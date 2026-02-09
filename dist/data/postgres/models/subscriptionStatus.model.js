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
exports.Subscription = exports.SubscriptionPlan = exports.SubscriptionStatus = void 0;
// ENTIDAD: Subscription
const typeorm_1 = require("typeorm");
const index_1 = require("../../index");
var SubscriptionStatus;
(function (SubscriptionStatus) {
    SubscriptionStatus["ACTIVA"] = "ACTIVA";
    SubscriptionStatus["EXPIRADA"] = "EXPIRADA";
    SubscriptionStatus["CANCELADA"] = "CANCELADA";
    SubscriptionStatus["PENDIENTE"] = "PENDIENTE";
})(SubscriptionStatus || (exports.SubscriptionStatus = SubscriptionStatus = {}));
var SubscriptionPlan;
(function (SubscriptionPlan) {
    SubscriptionPlan["BASIC"] = "basic";
    SubscriptionPlan["PREMIUM"] = "premium";
    SubscriptionPlan["BUSINESS"] = "business";
})(SubscriptionPlan || (exports.SubscriptionPlan = SubscriptionPlan = {}));
let Subscription = class Subscription extends typeorm_1.BaseEntity {
    // Método para verificar si la suscripción está activa
    isActive() {
        const now = new Date();
        return (this.status === SubscriptionStatus.ACTIVA &&
            this.startDate <= now &&
            (this.endDate === null || this.endDate >= now));
    }
    // Método para verificar si la suscripción está expirada
    isExpired() {
        const now = new Date();
        return this.endDate !== null && this.endDate < now;
    }
};
exports.Subscription = Subscription;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)("uuid"),
    __metadata("design:type", String)
], Subscription.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => index_1.User, (user) => user.subscriptions, { onDelete: "CASCADE" }),
    __metadata("design:type", index_1.User)
], Subscription.prototype, "user", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "timestamp" }),
    __metadata("design:type", Date)
], Subscription.prototype, "startDate", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "timestamp", nullable: true }),
    __metadata("design:type", Object)
], Subscription.prototype, "endDate", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: "enum",
        enum: SubscriptionStatus,
        default: SubscriptionStatus.PENDIENTE,
    }),
    __metadata("design:type", String)
], Subscription.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: "enum",
        enum: SubscriptionPlan,
        nullable: false,
    }),
    __metadata("design:type", String)
], Subscription.prototype, "plan", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "boolean", default: false }),
    __metadata("design:type", Boolean)
], Subscription.prototype, "autoRenewal", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", nullable: true }),
    __metadata("design:type", String)
], Subscription.prototype, "paymentMethod", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", nullable: true }),
    __metadata("design:type", String)
], Subscription.prototype, "transactionId", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], Subscription.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], Subscription.prototype, "updatedAt", void 0);
exports.Subscription = Subscription = __decorate([
    (0, typeorm_1.Entity)()
], Subscription);
