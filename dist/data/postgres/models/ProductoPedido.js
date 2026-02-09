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
exports.ProductoPedido = void 0;
const typeorm_1 = require("typeorm");
const Pedido_1 = require("./Pedido");
const Producto_1 = require("./Producto");
let ProductoPedido = class ProductoPedido extends typeorm_1.BaseEntity {
};
exports.ProductoPedido = ProductoPedido;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)("uuid"),
    __metadata("design:type", String)
], ProductoPedido.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Pedido_1.Pedido, (pedido) => pedido.productos, { onDelete: "CASCADE" }),
    __metadata("design:type", Pedido_1.Pedido)
], ProductoPedido.prototype, "pedido", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Producto_1.Producto),
    __metadata("design:type", Producto_1.Producto)
], ProductoPedido.prototype, "producto", void 0);
__decorate([
    (0, typeorm_1.Column)("int"),
    __metadata("design:type", Number)
], ProductoPedido.prototype, "cantidad", void 0);
__decorate([
    (0, typeorm_1.Column)("decimal", { precision: 10, scale: 2 }),
    __metadata("design:type", Number)
], ProductoPedido.prototype, "subtotal", void 0);
__decorate([
    (0, typeorm_1.Column)("decimal", { precision: 10, scale: 2, default: 0 }),
    __metadata("design:type", Number)
], ProductoPedido.prototype, "precio_venta", void 0);
__decorate([
    (0, typeorm_1.Column)("decimal", { precision: 10, scale: 2, default: 0 }),
    __metadata("design:type", Number)
], ProductoPedido.prototype, "precio_app", void 0);
__decorate([
    (0, typeorm_1.Column)("decimal", { precision: 10, scale: 2, default: 0 }),
    __metadata("design:type", Number)
], ProductoPedido.prototype, "comision_producto", void 0);
exports.ProductoPedido = ProductoPedido = __decorate([
    (0, typeorm_1.Entity)()
], ProductoPedido);
