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
exports.Post = void 0;
const typeorm_1 = require("typeorm");
const user_model_1 = require("./user.model"); // Importar la entidad User
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
        nullable: true
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
    (0, typeorm_1.Column)("timestamp", {
        default: () => "CURRENT_TIMESTAMP",
    }),
    __metadata("design:type", Date)
], Post.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.Column)("bool", {
        default: true,
    }),
    __metadata("design:type", Boolean)
], Post.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => user_model_1.User, (user) => user.posts) // Un post pertenece a un usuario
    ,
    (0, typeorm_1.JoinColumn)({ name: "userId" }) // La columna que se usa para la relación
    ,
    __metadata("design:type", user_model_1.User)
], Post.prototype, "user", void 0);
exports.Post = Post = __decorate([
    (0, typeorm_1.Entity)()
], Post);
