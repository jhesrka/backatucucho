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
exports.Useradmin = exports.UserRoleAdmin = exports.Statusadmin = void 0;
const typeorm_1 = require("typeorm");
const config_1 = require("../../../config");
var Statusadmin;
(function (Statusadmin) {
    Statusadmin["ACTIVE"] = "ACTIVE";
    Statusadmin["INACTIVE"] = "INACTIVE";
    Statusadmin["DELETED"] = "DELETED";
})(Statusadmin || (exports.Statusadmin = Statusadmin = {}));
var UserRoleAdmin;
(function (UserRoleAdmin) {
    UserRoleAdmin["ADMIN"] = "ADMIN";
    UserRoleAdmin["ASISTENTE"] = "ASISTENTE";
})(UserRoleAdmin || (exports.UserRoleAdmin = UserRoleAdmin = {}));
let Useradmin = class Useradmin extends typeorm_1.BaseEntity {
    encryptedPassword() {
        this.password = config_1.encriptAdapter.hash(this.password);
    }
};
exports.Useradmin = Useradmin;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)("uuid"),
    __metadata("design:type", String)
], Useradmin.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)("varchar", {
        length: 80,
        nullable: false,
    }),
    __metadata("design:type", String)
], Useradmin.prototype, "username", void 0);
__decorate([
    (0, typeorm_1.Column)("varchar", {
        length: 80,
        nullable: false,
    }),
    __metadata("design:type", String)
], Useradmin.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)("varchar", {
        length: 80,
        nullable: false,
    }),
    __metadata("design:type", String)
], Useradmin.prototype, "surname", void 0);
__decorate([
    (0, typeorm_1.Column)("varchar", {
        length: 80,
        nullable: false,
        unique: true,
    }),
    __metadata("design:type", String)
], Useradmin.prototype, "email", void 0);
__decorate([
    (0, typeorm_1.Column)("varchar", {
        nullable: false,
    }),
    __metadata("design:type", String)
], Useradmin.prototype, "password", void 0);
__decorate([
    (0, typeorm_1.Column)("varchar", {
        length: 10,
        nullable: false,
        unique: true,
    }),
    __metadata("design:type", String)
], Useradmin.prototype, "whatsapp", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({
        type: "timestamp",
        default: () => "CURRENT_TIMESTAMP",
    }),
    __metadata("design:type", Date)
], Useradmin.prototype, "created_at", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({
        type: "timestamp",
        default: () => "CURRENT_TIMESTAMP",
        onUpdate: "CURRENT_TIMESTAMP",
    }),
    __metadata("design:type", Date)
], Useradmin.prototype, "updated_at", void 0);
__decorate([
    (0, typeorm_1.Column)("enum", {
        enum: UserRoleAdmin,
        default: UserRoleAdmin.ADMIN,
    }),
    __metadata("design:type", String)
], Useradmin.prototype, "rol", void 0);
__decorate([
    (0, typeorm_1.Column)("enum", {
        enum: Statusadmin,
        default: Statusadmin.ACTIVE,
    }),
    __metadata("design:type", String)
], Useradmin.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.BeforeInsert)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], Useradmin.prototype, "encryptedPassword", null);
exports.Useradmin = Useradmin = __decorate([
    (0, typeorm_1.Entity)()
], Useradmin);
