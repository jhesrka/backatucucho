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
exports.TipoProducto = void 0;
// src/data/entities/TipoProducto.ts
const typeorm_1 = require("typeorm");
const Producto_1 = require("./Producto");
const Negocio_1 = require("./Negocio");
let TipoProducto = class TipoProducto extends typeorm_1.BaseEntity {
};
exports.TipoProducto = TipoProducto;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)("uuid"),
    __metadata("design:type", String)
], TipoProducto.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 50 }),
    __metadata("design:type", String)
], TipoProducto.prototype, "nombre", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Negocio_1.Negocio, (negocio) => negocio.tipos, {
        onDelete: "CASCADE",
        nullable: false,
    }),
    __metadata("design:type", Negocio_1.Negocio)
], TipoProducto.prototype, "negocio", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => Producto_1.Producto, (producto) => producto.tipo),
    __metadata("design:type", Array)
], TipoProducto.prototype, "productos", void 0);
exports.TipoProducto = TipoProducto = __decorate([
    (0, typeorm_1.Entity)()
], TipoProducto);
