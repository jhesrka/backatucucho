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
exports.Producto = exports.StatusProducto = void 0;
const typeorm_1 = require("typeorm");
const Negocio_1 = require("./Negocio");
const TipoProducto_1 = require("./TipoProducto");
var StatusProducto;
(function (StatusProducto) {
    StatusProducto["PENDIENTE"] = "PENDIENTE";
    StatusProducto["ACTIVO"] = "ACTIVO";
    StatusProducto["SUSPENDIDO"] = "SUSPENDIDO";
    StatusProducto["BLOQUEADO"] = "BLOQUEADO";
})(StatusProducto || (exports.StatusProducto = StatusProducto = {}));
let Producto = class Producto extends typeorm_1.BaseEntity {
};
exports.Producto = Producto;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)("uuid"),
    __metadata("design:type", String)
], Producto.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 100 }),
    __metadata("design:type", String)
], Producto.prototype, "nombre", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "text", nullable: true }),
    __metadata("design:type", String)
], Producto.prototype, "descripcion", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", nullable: true }),
    __metadata("design:type", String)
], Producto.prototype, "imagen", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "boolean", default: true }),
    __metadata("design:type", Boolean)
], Producto.prototype, "disponible", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: "enum",
        enum: StatusProducto,
        default: StatusProducto.PENDIENTE,
    }),
    __metadata("design:type", String)
], Producto.prototype, "statusProducto", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], Producto.prototype, "created_at", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], Producto.prototype, "updated_at", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Negocio_1.Negocio, (negocio) => negocio.productos),
    __metadata("design:type", Negocio_1.Negocio)
], Producto.prototype, "negocio", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => TipoProducto_1.TipoProducto, (tipo) => tipo.productos, {
        nullable: true,
        onDelete: "SET NULL", // <-- esto es clave
    }),
    __metadata("design:type", Object)
], Producto.prototype, "tipo", void 0);
__decorate([
    (0, typeorm_1.Column)("decimal", { precision: 10, scale: 2, default: 0 }),
    __metadata("design:type", Number)
], Producto.prototype, "precio_venta", void 0);
__decorate([
    (0, typeorm_1.Column)("decimal", { precision: 10, scale: 2, default: 0 }),
    __metadata("design:type", Number)
], Producto.prototype, "precio_app", void 0);
__decorate([
    (0, typeorm_1.Column)("decimal", { precision: 10, scale: 2, default: 0 }),
    __metadata("design:type", Number)
], Producto.prototype, "comision_producto", void 0);
exports.Producto = Producto = __decorate([
    (0, typeorm_1.Entity)(),
    (0, typeorm_1.Unique)(["nombre", "negocio"]) // ✅ El nombre será único solo dentro del mismo negocio
], Producto);
