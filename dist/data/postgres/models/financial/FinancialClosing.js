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
exports.FinancialClosing = void 0;
const typeorm_1 = require("typeorm");
const useradmin_model_1 = require("../useradmin.model");
let FinancialClosing = class FinancialClosing extends typeorm_1.BaseEntity {
};
exports.FinancialClosing = FinancialClosing;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], FinancialClosing.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'date', unique: true }),
    __metadata("design:type", String)
], FinancialClosing.prototype, "closingDate", void 0);
__decorate([
    (0, typeorm_1.Column)('decimal', { precision: 10, scale: 2 }),
    __metadata("design:type", Number)
], FinancialClosing.prototype, "totalIncome", void 0);
__decorate([
    (0, typeorm_1.Column)('decimal', { precision: 10, scale: 2 }),
    __metadata("design:type", Number)
], FinancialClosing.prototype, "totalExpenses", void 0);
__decorate([
    (0, typeorm_1.Column)('varchar'),
    __metadata("design:type", String)
], FinancialClosing.prototype, "backupFileUrl", void 0);
__decorate([
    (0, typeorm_1.Column)('int'),
    __metadata("design:type", Number)
], FinancialClosing.prototype, "totalRechargesCount", void 0);
__decorate([
    (0, typeorm_1.Column)('decimal', { precision: 10, scale: 2, default: 0 }),
    __metadata("design:type", Number)
], FinancialClosing.prototype, "totalUserBalance", void 0);
__decorate([
    (0, typeorm_1.Column)('decimal', { precision: 10, scale: 2, default: 0 }),
    __metadata("design:type", Number)
], FinancialClosing.prototype, "totalMotorizadoDebt", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => useradmin_model_1.Useradmin),
    __metadata("design:type", useradmin_model_1.Useradmin)
], FinancialClosing.prototype, "closedBy", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], FinancialClosing.prototype, "createdAt", void 0);
exports.FinancialClosing = FinancialClosing = __decorate([
    (0, typeorm_1.Entity)('financial_closings')
], FinancialClosing);
