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
exports.User = exports.UserRole = exports.Status = void 0;
const typeorm_1 = require("typeorm");
const config_1 = require("../../../config");
const index_1 = require("../../index");
const Negocio_1 = require("./Negocio");
const Pedido_1 = require("./Pedido");
var Status;
(function (Status) {
    Status["ACTIVE"] = "ACTIVE";
    Status["INACTIVE"] = "INACTIVE";
    Status["DELETED"] = "DELETED";
    Status["BANNED"] = "BANNED";
})(Status || (exports.Status = Status = {}));
var UserRole;
(function (UserRole) {
    UserRole["ADMIN"] = "ADMIN";
    UserRole["USER"] = "USER";
})(UserRole || (exports.UserRole = UserRole = {}));
let User = class User extends typeorm_1.BaseEntity {
    encryptedPassword() {
        if (this.password) {
            this.password = config_1.encriptAdapter.hash(this.password);
        }
    }
};
exports.User = User;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)("uuid"),
    __metadata("design:type", String)
], User.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)("varchar", {
        length: 100,
        nullable: true,
        unique: true,
    }),
    __metadata("design:type", String)
], User.prototype, "googleId", void 0);
__decorate([
    (0, typeorm_1.Column)("varchar", {
        length: 80,
        nullable: false,
    }),
    __metadata("design:type", String)
], User.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)("varchar", {
        length: 80,
        nullable: false,
    }),
    __metadata("design:type", String)
], User.prototype, "surname", void 0);
__decorate([
    (0, typeorm_1.Column)("varchar", {
        length: 80,
        nullable: false,
        unique: true,
    }),
    __metadata("design:type", String)
], User.prototype, "email", void 0);
__decorate([
    (0, typeorm_1.Column)("varchar", {
        nullable: true,
    }),
    __metadata("design:type", String)
], User.prototype, "password", void 0);
__decorate([
    (0, typeorm_1.Column)("date", {
        nullable: false,
    }),
    __metadata("design:type", Date)
], User.prototype, "birthday", void 0);
__decorate([
    (0, typeorm_1.Column)("varchar", {
        nullable: true,
        default: "ImgStore/user.png",
    }),
    __metadata("design:type", String)
], User.prototype, "photoperfil", void 0);
__decorate([
    (0, typeorm_1.Column)("varchar", {
        length: 15,
        nullable: true,
        unique: true,
    }),
    __metadata("design:type", String)
], User.prototype, "whatsapp", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ type: "timestamp" }),
    __metadata("design:type", Date)
], User.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ type: "timestamp" }),
    __metadata("design:type", Date)
], User.prototype, "updated_at", void 0);
__decorate([
    (0, typeorm_1.Column)("enum", {
        enum: UserRole,
        default: UserRole.USER,
    }),
    __metadata("design:type", String)
], User.prototype, "rol", void 0);
__decorate([
    (0, typeorm_1.Column)("enum", {
        enum: Status,
        default: Status.INACTIVE,
    }),
    __metadata("design:type", String)
], User.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)("int", { default: 0 }),
    __metadata("design:type", Number)
], User.prototype, "resetTokenVersion", void 0);
__decorate([
    (0, typeorm_1.Column)("boolean", { default: false }),
    __metadata("design:type", Boolean)
], User.prototype, "isLoggedIn", void 0);
__decorate([
    (0, typeorm_1.Column)("varchar", { nullable: true }),
    __metadata("design:type", String)
], User.prototype, "currentSessionId", void 0);
__decorate([
    (0, typeorm_1.Column)("varchar", { nullable: true }),
    __metadata("design:type", String)
], User.prototype, "lastLoginIP", void 0);
__decorate([
    (0, typeorm_1.Column)("varchar", { nullable: true }),
    __metadata("design:type", String)
], User.prototype, "lastLoginCountry", void 0);
__decorate([
    (0, typeorm_1.Column)("timestamp", { nullable: true }),
    __metadata("design:type", Date)
], User.prototype, "lastLoginDate", void 0);
__decorate([
    (0, typeorm_1.Column)("varchar", { nullable: true }),
    __metadata("design:type", String)
], User.prototype, "lastDeviceInfo", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => index_1.Post, (post) => post.user),
    __metadata("design:type", Array)
], User.prototype, "posts", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => index_1.Storie, (storie) => storie.user),
    __metadata("design:type", Array)
], User.prototype, "stories", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => index_1.Like, (like) => like.user),
    __metadata("design:type", Array)
], User.prototype, "likes", void 0);
__decorate([
    (0, typeorm_1.OneToOne)(() => index_1.Wallet, (wallet) => wallet.user, { cascade: true }),
    __metadata("design:type", index_1.Wallet)
], User.prototype, "wallet", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => index_1.Subscription, (sub) => sub.user),
    __metadata("design:type", Array)
], User.prototype, "subscriptions", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => index_1.RechargeRequest, (req) => req.user),
    __metadata("design:type", Array)
], User.prototype, "rechargeRequests", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => index_1.FreePostTracker, (tracker) => tracker.user),
    __metadata("design:type", Array)
], User.prototype, "freePostTrackers", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => Negocio_1.Negocio, (negocio) => negocio.usuario),
    __metadata("design:type", Array)
], User.prototype, "negocios", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => Pedido_1.Pedido, (pedido) => pedido.cliente),
    __metadata("design:type", Array)
], User.prototype, "pedidos", void 0);
__decorate([
    (0, typeorm_1.Column)("varchar", {
        nullable: true,
        default: null
    }),
    __metadata("design:type", Object)
], User.prototype, "acceptedTermsVersion", void 0);
__decorate([
    (0, typeorm_1.Column)("timestamp", { nullable: true }),
    __metadata("design:type", Object)
], User.prototype, "acceptedTermsAt", void 0);
__decorate([
    (0, typeorm_1.Column)("varchar", {
        nullable: true,
        default: null
    }),
    __metadata("design:type", Object)
], User.prototype, "acceptedPrivacyVersion", void 0);
__decorate([
    (0, typeorm_1.Column)("timestamp", { nullable: true }),
    __metadata("design:type", Object)
], User.prototype, "acceptedPrivacyAt", void 0);
__decorate([
    (0, typeorm_1.OneToMany)("Report", "user") // Using string for relation to avoid circular dependency issues if Report isn't imported yet, or import it.
    ,
    __metadata("design:type", Array)
], User.prototype, "reports", void 0);
__decorate([
    (0, typeorm_1.DeleteDateColumn)({ type: "timestamp", nullable: true }),
    __metadata("design:type", Date)
], User.prototype, "deletedAt", void 0);
__decorate([
    (0, typeorm_1.BeforeInsert)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], User.prototype, "encryptedPassword", null);
exports.User = User = __decorate([
    (0, typeorm_1.Entity)()
], User);
