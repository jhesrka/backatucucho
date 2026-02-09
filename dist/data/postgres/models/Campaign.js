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
exports.Campaign = exports.CampaignStatus = exports.CampaignType = void 0;
const typeorm_1 = require("typeorm");
const CampaignLog_1 = require("./CampaignLog");
var CampaignType;
(function (CampaignType) {
    CampaignType["EMAIL"] = "EMAIL";
    CampaignType["WHATSAPP"] = "WHATSAPP";
})(CampaignType || (exports.CampaignType = CampaignType = {}));
var CampaignStatus;
(function (CampaignStatus) {
    CampaignStatus["DRAFT"] = "DRAFT";
    CampaignStatus["PENDING"] = "PENDING";
    CampaignStatus["PROCESSING"] = "PROCESSING";
    CampaignStatus["PAUSED"] = "PAUSED";
    CampaignStatus["COMPLETED"] = "COMPLETED";
    CampaignStatus["FAILED"] = "FAILED";
})(CampaignStatus || (exports.CampaignStatus = CampaignStatus = {}));
let Campaign = class Campaign extends typeorm_1.BaseEntity {
};
exports.Campaign = Campaign;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)("uuid"),
    __metadata("design:type", String)
], Campaign.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "enum", enum: CampaignType }),
    __metadata("design:type", String)
], Campaign.prototype, "type", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "enum", enum: CampaignStatus, default: CampaignStatus.DRAFT }),
    __metadata("design:type", String)
], Campaign.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], Campaign.prototype, "subject", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], Campaign.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)("text"),
    __metadata("design:type", String)
], Campaign.prototype, "content", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], Campaign.prototype, "mediaUrl", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], Campaign.prototype, "mediaType", void 0);
__decorate([
    (0, typeorm_1.Column)("jsonb", { nullable: true }),
    __metadata("design:type", Object)
], Campaign.prototype, "filters", void 0);
__decorate([
    (0, typeorm_1.Column)("int", { default: 0 }),
    __metadata("design:type", Number)
], Campaign.prototype, "totalTargets", void 0);
__decorate([
    (0, typeorm_1.Column)("int", { default: 0 }),
    __metadata("design:type", Number)
], Campaign.prototype, "sentCount", void 0);
__decorate([
    (0, typeorm_1.Column)("int", { default: 0 }),
    __metadata("design:type", Number)
], Campaign.prototype, "failedCount", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], Campaign.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], Campaign.prototype, "updatedAt", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => CampaignLog_1.CampaignLog, (log) => log.campaign),
    __metadata("design:type", Array)
], Campaign.prototype, "logs", void 0);
exports.Campaign = Campaign = __decorate([
    (0, typeorm_1.Entity)()
], Campaign);
