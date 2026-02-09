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
exports.Storie = exports.StatusStorie = void 0;
const typeorm_1 = require("typeorm");
const user_model_1 = require("./user.model"); // Importar la entidad User
var StatusStorie;
(function (StatusStorie) {
    StatusStorie["PUBLISHED"] = "PUBLISHED";
    StatusStorie["HIDDEN"] = "HIDDEN";
    StatusStorie["DELETED"] = "DELETED";
    StatusStorie["BANNED"] = "BANNED";
})(StatusStorie || (exports.StatusStorie = StatusStorie = {}));
let Storie = class Storie extends typeorm_1.BaseEntity {
};
exports.Storie = Storie;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)("uuid"),
    __metadata("design:type", String)
], Storie.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)("text", {
        nullable: false,
    }),
    __metadata("design:type", String)
], Storie.prototype, "description", void 0);
__decorate([
    (0, typeorm_1.Column)("varchar", {
        nullable: true,
    }),
    __metadata("design:type", String)
], Storie.prototype, "imgstorie", void 0);
__decorate([
    (0, typeorm_1.Column)("timestamp", {
        default: () => "CURRENT_TIMESTAMP",
    }),
    __metadata("design:type", Date)
], Storie.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.Column)("timestamp", {
        default: () => "CURRENT_TIMESTAMP",
    }),
    __metadata("design:type", Date)
], Storie.prototype, "expires_at", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "timestamp", nullable: true }),
    __metadata("design:type", Date)
], Storie.prototype, "deletedAt", void 0);
__decorate([
    (0, typeorm_1.Column)("decimal", { precision: 10, scale: 2, default: 0 }),
    __metadata("design:type", Number)
], Storie.prototype, "val_primer_dia", void 0);
__decorate([
    (0, typeorm_1.Column)("decimal", { precision: 10, scale: 2, default: 0 }),
    __metadata("design:type", Number)
], Storie.prototype, "val_dias_adicionales", void 0);
__decorate([
    (0, typeorm_1.Column)("decimal", { precision: 10, scale: 2, default: 0 }),
    __metadata("design:type", Number)
], Storie.prototype, "total_pagado", void 0);
__decorate([
    (0, typeorm_1.Column)("boolean", { default: true }),
    __metadata("design:type", Boolean)
], Storie.prototype, "showWhatsapp", void 0);
__decorate([
    (0, typeorm_1.Column)("enum", {
        enum: StatusStorie,
        default: StatusStorie.PUBLISHED,
    }),
    __metadata("design:type", String)
], Storie.prototype, "statusStorie", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => user_model_1.User, (user) => user.stories) // Un post pertenece a un usuario
    ,
    (0, typeorm_1.JoinColumn)({ name: "userIdStories" }) // La columna que se usa para la relación
    ,
    __metadata("design:type", user_model_1.User)
], Storie.prototype, "user", void 0);
exports.Storie = Storie = __decorate([
    (0, typeorm_1.Entity)()
], Storie);
