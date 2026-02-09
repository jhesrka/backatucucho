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
exports.Report = exports.ReportType = exports.ReportStatus = void 0;
const typeorm_1 = require("typeorm");
const user_model_1 = require("./user.model");
var ReportStatus;
(function (ReportStatus) {
    ReportStatus["PENDING"] = "PENDING";
    ReportStatus["IN_REVIEW"] = "IN_REVIEW";
    ReportStatus["RESOLVED"] = "RESOLVED";
})(ReportStatus || (exports.ReportStatus = ReportStatus = {}));
var ReportType;
(function (ReportType) {
    ReportType["BUG"] = "BUG";
    ReportType["PAYMENT"] = "PAYMENT";
    ReportType["CONTENT"] = "CONTENT";
    ReportType["OTHER"] = "OTHER";
})(ReportType || (exports.ReportType = ReportType = {}));
let Report = class Report extends typeorm_1.BaseEntity {
};
exports.Report = Report;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)("uuid"),
    __metadata("design:type", String)
], Report.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => user_model_1.User, (user) => user.reports),
    __metadata("design:type", user_model_1.User)
], Report.prototype, "user", void 0);
__decorate([
    (0, typeorm_1.Column)("enum", { enum: ReportType }),
    __metadata("design:type", String)
], Report.prototype, "type", void 0);
__decorate([
    (0, typeorm_1.Column)("text"),
    __metadata("design:type", String)
], Report.prototype, "description", void 0);
__decorate([
    (0, typeorm_1.Column)("enum", { enum: ReportStatus, default: ReportStatus.PENDING }),
    __metadata("design:type", String)
], Report.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], Report.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], Report.prototype, "updatedAt", void 0);
exports.Report = Report = __decorate([
    (0, typeorm_1.Entity)()
], Report);
