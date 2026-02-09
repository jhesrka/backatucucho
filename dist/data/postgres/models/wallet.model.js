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
exports.Wallet = exports.WalletStatus = void 0;
// src/data/models/wallet.model.ts
const typeorm_1 = require("typeorm");
const index_1 = require("../../index");
var WalletStatus;
(function (WalletStatus) {
    WalletStatus["ACTIVO"] = "ACTIVO";
    WalletStatus["BLOQUEADO"] = "BLOQUEADO";
})(WalletStatus || (exports.WalletStatus = WalletStatus = {}));
let Wallet = class Wallet extends typeorm_1.BaseEntity {
};
exports.Wallet = Wallet;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], Wallet.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.OneToOne)(() => index_1.User, user => user.wallet, { eager: false }),
    (0, typeorm_1.JoinColumn)(),
    __metadata("design:type", index_1.User)
], Wallet.prototype, "user", void 0);
__decorate([
    (0, typeorm_1.Column)('decimal', { precision: 10, scale: 2, default: 0 }),
    __metadata("design:type", Number)
], Wallet.prototype, "balance", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: "enum",
        enum: WalletStatus,
        default: WalletStatus.ACTIVO,
    }),
    __metadata("design:type", String)
], Wallet.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ type: "timestamp", name: 'created_at' }),
    __metadata("design:type", Date)
], Wallet.prototype, "created_at", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ type: "timestamp", name: 'updated_at' }),
    __metadata("design:type", Date)
], Wallet.prototype, "updated_at", void 0);
exports.Wallet = Wallet = __decorate([
    (0, typeorm_1.Entity)('wallets')
], Wallet);
