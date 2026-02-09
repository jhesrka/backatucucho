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
exports.CampaignLog = exports.LogStatus = void 0;
const typeorm_1 = require("typeorm");
const Campaign_1 = require("./Campaign");
const user_model_1 = require("./user.model");
var LogStatus;
(function (LogStatus) {
    LogStatus["SENT"] = "SENT";
    LogStatus["FAILED"] = "FAILED";
    LogStatus["PENDING"] = "PENDING";
})(LogStatus || (exports.LogStatus = LogStatus = {}));
let CampaignLog = class CampaignLog extends typeorm_1.BaseEntity {
};
exports.CampaignLog = CampaignLog;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)("uuid"),
    __metadata("design:type", String)
], CampaignLog.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Campaign_1.Campaign, (campaign) => campaign.logs),
    __metadata("design:type", Campaign_1.Campaign)
], CampaignLog.prototype, "campaign", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => user_model_1.User, { nullable: true }),
    __metadata("design:type", user_model_1.User)
], CampaignLog.prototype, "user", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], CampaignLog.prototype, "targetContact", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "enum", enum: LogStatus }),
    __metadata("design:type", String)
], CampaignLog.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)("text", { nullable: true }),
    __metadata("design:type", String)
], CampaignLog.prototype, "errorMessage", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], CampaignLog.prototype, "attemptedAt", void 0);
exports.CampaignLog = CampaignLog = __decorate([
    (0, typeorm_1.Entity)()
], CampaignLog);
