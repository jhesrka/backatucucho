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
exports.FreePostTracker = void 0;
// ENTIDAD: FreePostTracker
const typeorm_1 = require("typeorm");
const index_1 = require("../../index");
let FreePostTracker = class FreePostTracker extends typeorm_1.BaseEntity {
};
exports.FreePostTracker = FreePostTracker;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)("uuid"),
    __metadata("design:type", String)
], FreePostTracker.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "int", default: 0 }),
    __metadata("design:type", Number)
], FreePostTracker.prototype, "count", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "date" }),
    __metadata("design:type", Date)
], FreePostTracker.prototype, "monthYear", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => index_1.User, (user) => user.freePostTrackers),
    __metadata("design:type", index_1.User)
], FreePostTracker.prototype, "user", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => index_1.Post, (post) => post.freePostTracker),
    __metadata("design:type", Array)
], FreePostTracker.prototype, "posts", void 0);
exports.FreePostTracker = FreePostTracker = __decorate([
    (0, typeorm_1.Entity)()
], FreePostTracker);
