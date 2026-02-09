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
exports.Post = exports.StatusPost = void 0;
const typeorm_1 = require("typeorm");
const index_1 = require("../../index");
var StatusPost;
(function (StatusPost) {
    StatusPost["PUBLICADO"] = "PUBLICADO";
    StatusPost["OCULTO"] = "OCULTO";
    StatusPost["ELIMINADO"] = "ELIMINADO";
    StatusPost["BLOQUEADO"] = "BLOQUEADO";
})(StatusPost || (exports.StatusPost = StatusPost = {}));
let Post = class Post extends typeorm_1.BaseEntity {
};
exports.Post = Post;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)("uuid"),
    __metadata("design:type", String)
], Post.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)("text", {
        nullable: false,
    }),
    __metadata("design:type", String)
], Post.prototype, "content", void 0);
__decorate([
    (0, typeorm_1.Column)("varchar", {
        array: true,
        nullable: true,
    }),
    __metadata("design:type", Array)
], Post.prototype, "imgpost", void 0);
__decorate([
    (0, typeorm_1.Column)("varchar", {
        length: 30,
        nullable: false,
    }),
    __metadata("design:type", String)
], Post.prototype, "title", void 0);
__decorate([
    (0, typeorm_1.Column)("varchar", {
        length: 30,
        nullable: false,
    }),
    __metadata("design:type", String)
], Post.prototype, "subtitle", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: true }),
    __metadata("design:type", Boolean)
], Post.prototype, "isPaid", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ type: 'timestamp' }) // <-- Esto soluciona el problema
    ,
    __metadata("design:type", Date)
], Post.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "timestamp", nullable: true }),
    __metadata("design:type", Date)
], Post.prototype, "expiresAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "timestamp", nullable: true }),
    __metadata("design:type", Date)
], Post.prototype, "deletedAt", void 0);
__decorate([
    (0, typeorm_1.Column)("enum", {
        enum: StatusPost,
        default: StatusPost.PUBLICADO,
    }),
    __metadata("design:type", String)
], Post.prototype, "statusPost", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "int", default: 0 }),
    __metadata("design:type", Number)
], Post.prototype, "likesCount", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "boolean", default: true }),
    __metadata("design:type", Boolean)
], Post.prototype, "showWhatsApp", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "boolean", default: true }),
    __metadata("design:type", Boolean)
], Post.prototype, "showLikes", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "uuid", nullable: true }),
    __metadata("design:type", String)
], Post.prototype, "freePostTrackerId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => index_1.User, (user) => user.posts, {
        eager: false,
        onDelete: "CASCADE",
    }),
    (0, typeorm_1.JoinColumn)({ name: "userId" }) // La columna que se usa para la relación
    ,
    __metadata("design:type", index_1.User)
], Post.prototype, "user", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => index_1.FreePostTracker, (tracker) => tracker.posts, {
        onDelete: "SET NULL",
        nullable: true,
    }),
    (0, typeorm_1.JoinColumn)({ name: "freePostTrackerId" }),
    __metadata("design:type", index_1.FreePostTracker)
], Post.prototype, "freePostTracker", void 0);
exports.Post = Post = __decorate([
    (0, typeorm_1.Entity)()
], Post);
