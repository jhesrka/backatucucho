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
exports.GlobalSettings = void 0;
const typeorm_1 = require("typeorm");
let GlobalSettings = class GlobalSettings extends typeorm_1.BaseEntity {
};
exports.GlobalSettings = GlobalSettings;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)("uuid"),
    __metadata("design:type", String)
], GlobalSettings.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)("int", { default: 20 }),
    __metadata("design:type", Number)
], GlobalSettings.prototype, "orderRetentionDays", void 0);
__decorate([
    (0, typeorm_1.Column)("int", { default: 60 }),
    __metadata("design:type", Number)
], GlobalSettings.prototype, "rechargeRetentionDays", void 0);
__decorate([
    (0, typeorm_1.Column)("varchar", { length: 60, nullable: true }),
    __metadata("design:type", String)
], GlobalSettings.prototype, "masterPin", void 0);
__decorate([
    (0, typeorm_1.Column)("int", { default: 5 }),
    __metadata("design:type", Number)
], GlobalSettings.prototype, "freePostsLimit", void 0);
__decorate([
    (0, typeorm_1.Column)("int", { default: 1 }),
    __metadata("design:type", Number)
], GlobalSettings.prototype, "freePostDurationDays", void 0);
__decorate([
    (0, typeorm_1.Column)("int", { default: 0 }),
    __metadata("design:type", Number)
], GlobalSettings.prototype, "freePostDurationHours", void 0);
__decorate([
    (0, typeorm_1.Column)("varchar", { length: 20, nullable: true }),
    __metadata("design:type", String)
], GlobalSettings.prototype, "supportWhatsapp", void 0);
__decorate([
    (0, typeorm_1.Column)("text", { nullable: true }),
    __metadata("design:type", String)
], GlobalSettings.prototype, "termsAndConditions", void 0);
__decorate([
    (0, typeorm_1.Column)("text", { nullable: true }),
    __metadata("design:type", String)
], GlobalSettings.prototype, "privacyPolicy", void 0);
__decorate([
    (0, typeorm_1.Column)("decimal", { precision: 10, scale: 2, default: 5.00 }),
    __metadata("design:type", Number)
], GlobalSettings.prototype, "subscriptionBasicPrice", void 0);
__decorate([
    (0, typeorm_1.Column)("decimal", { precision: 10, scale: 2, nullable: true }),
    __metadata("design:type", Number)
], GlobalSettings.prototype, "subscriptionBasicPromoPrice", void 0);
__decorate([
    (0, typeorm_1.Column)("int", { default: 30 }),
    __metadata("design:type", Number)
], GlobalSettings.prototype, "subscriptionBasicDurationDays", void 0);
__decorate([
    (0, typeorm_1.Column)("varchar", { length: 20, default: "v1.0" }),
    __metadata("design:type", String)
], GlobalSettings.prototype, "currentTermsVersion", void 0);
__decorate([
    (0, typeorm_1.Column)("timestamp", { default: () => "CURRENT_TIMESTAMP" }),
    __metadata("design:type", Date)
], GlobalSettings.prototype, "termsUpdatedAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], GlobalSettings.prototype, "updatedAt", void 0);
exports.GlobalSettings = GlobalSettings = __decorate([
    (0, typeorm_1.Entity)()
], GlobalSettings);
