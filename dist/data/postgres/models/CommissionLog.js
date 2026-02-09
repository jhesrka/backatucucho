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
exports.CommissionLog = void 0;
const typeorm_1 = require("typeorm");
const useradmin_model_1 = require("./useradmin.model");
let CommissionLog = class CommissionLog extends typeorm_1.BaseEntity {
};
exports.CommissionLog = CommissionLog;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)("uuid"),
    __metadata("design:type", String)
], CommissionLog.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)("decimal", { precision: 10, scale: 2 }),
    __metadata("design:type", Number)
], CommissionLog.prototype, "prevMotorizadoPercentage", void 0);
__decorate([
    (0, typeorm_1.Column)("decimal", { precision: 10, scale: 2 }),
    __metadata("design:type", Number)
], CommissionLog.prototype, "newMotorizadoPercentage", void 0);
__decorate([
    (0, typeorm_1.Column)("decimal", { precision: 10, scale: 2 }),
    __metadata("design:type", Number)
], CommissionLog.prototype, "prevAppPercentage", void 0);
__decorate([
    (0, typeorm_1.Column)("decimal", { precision: 10, scale: 2 }),
    __metadata("design:type", Number)
], CommissionLog.prototype, "newAppPercentage", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => useradmin_model_1.Useradmin),
    __metadata("design:type", useradmin_model_1.Useradmin)
], CommissionLog.prototype, "changedBy", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ type: "timestamp" }),
    __metadata("design:type", Date)
], CommissionLog.prototype, "createdAt", void 0);
exports.CommissionLog = CommissionLog = __decorate([
    (0, typeorm_1.Entity)()
], CommissionLog);
