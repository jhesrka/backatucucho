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
exports.Pedido = exports.MetodoPago = exports.EstadoPedido = void 0;
const typeorm_1 = require("typeorm");
const user_model_1 = require("./user.model");
const Negocio_1 = require("./Negocio");
var EstadoPedido;
(function (EstadoPedido) {
    EstadoPedido["PENDIENTE"] = "PENDIENTE";
    EstadoPedido["ACEPTADO"] = "ACEPTADO";
    EstadoPedido["PREPARANDO"] = "PREPARANDO";
    EstadoPedido["PREPARANDO_ASIGNADO"] = "PREPARANDO_ASIGNADO";
    EstadoPedido["PREPARANDO_NO_ASIGNADO"] = "PREPARANDO_NO_ASIGNADO";
    EstadoPedido["EN_CAMINO"] = "EN_CAMINO";
    EstadoPedido["ENTREGADO"] = "ENTREGADO";
    EstadoPedido["CANCELADO"] = "CANCELADO";
})(EstadoPedido || (exports.EstadoPedido = EstadoPedido = {}));
var MetodoPago;
(function (MetodoPago) {
    MetodoPago["EFECTIVO"] = "EFECTIVO";
    MetodoPago["TRANSFERENCIA"] = "TRANSFERENCIA";
})(MetodoPago || (exports.MetodoPago = MetodoPago = {}));
let Pedido = class Pedido extends typeorm_1.BaseEntity {
};
exports.Pedido = Pedido;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)("uuid"),
    __metadata("design:type", String)
], Pedido.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => user_model_1.User, (user) => user.pedidos),
    __metadata("design:type", user_model_1.User)
], Pedido.prototype, "cliente", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Negocio_1.Negocio, (negocio) => negocio.pedidos),
    (0, typeorm_1.JoinColumn)({ name: "negocioId" }) // Explicitly map to camelCase column verified in DB
    ,
    __metadata("design:type", Negocio_1.Negocio)
], Pedido.prototype, "negocio", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: "enum",
        enum: EstadoPedido,
        default: EstadoPedido.PENDIENTE,
    }),
    __metadata("design:type", String)
], Pedido.prototype, "estado", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: "enum",
        enum: MetodoPago,
        default: MetodoPago.EFECTIVO,
    }),
    __metadata("design:type", String)
], Pedido.prototype, "metodoPago", void 0);
__decorate([
    (0, typeorm_1.Column)("decimal", { precision: 10, scale: 2 }),
    __metadata("design:type", Number)
], Pedido.prototype, "total", void 0);
__decorate([
    (0, typeorm_1.Column)("decimal", { precision: 10, scale: 2, nullable: true }),
    __metadata("design:type", Object)
], Pedido.prototype, "montoVuelto", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "text", nullable: true }),
    __metadata("design:type", Object)
], Pedido.prototype, "comprobantePagoUrl", void 0);
__decorate([
    (0, typeorm_1.Column)("decimal", { precision: 10, scale: 2, default: 0 }),
    __metadata("design:type", Number)
], Pedido.prototype, "comisionTotal", void 0);
__decorate([
    (0, typeorm_1.Column)("decimal", { precision: 10, scale: 2, default: 0 }),
    __metadata("design:type", Number)
], Pedido.prototype, "totalNegocio", void 0);
__decorate([
    (0, typeorm_1.Column)("decimal", { precision: 10, scale: 2, default: 1.25 }),
    __metadata("design:type", Number)
], Pedido.prototype, "costoEnvio", void 0);
__decorate([
    (0, typeorm_1.Column)("decimal", { precision: 10, scale: 2, default: 80.00 }),
    __metadata("design:type", Number)
], Pedido.prototype, "porcentaje_motorizado_aplicado", void 0);
__decorate([
    (0, typeorm_1.Column)("decimal", { precision: 10, scale: 2, default: 20.00 }),
    __metadata("design:type", Number)
], Pedido.prototype, "porcentaje_app_aplicado", void 0);
__decorate([
    (0, typeorm_1.Column)("decimal", { precision: 10, scale: 2, default: 0 }),
    __metadata("design:type", Number)
], Pedido.prototype, "ganancia_motorizado", void 0);
__decorate([
    (0, typeorm_1.Column)("decimal", { precision: 10, scale: 2, default: 0 }),
    __metadata("design:type", Number)
], Pedido.prototype, "comision_app_domicilio", void 0);
__decorate([
    (0, typeorm_1.Column)("decimal", { precision: 10, scale: 2, default: 0 }),
    __metadata("design:type", Number)
], Pedido.prototype, "ganancia_app_producto", void 0);
__decorate([
    (0, typeorm_1.Column)("decimal", { precision: 10, scale: 2, default: 0 }),
    __metadata("design:type", Number)
], Pedido.prototype, "total_precio_venta_publico", void 0);
__decorate([
    (0, typeorm_1.Column)("decimal", { precision: 10, scale: 2, default: 0 }),
    __metadata("design:type", Number)
], Pedido.prototype, "total_precio_app", void 0);
__decorate([
    (0, typeorm_1.Column)("decimal", { precision: 10, scale: 2, default: 0 }),
    __metadata("design:type", Number)
], Pedido.prototype, "total_comision_productos", void 0);
__decorate([
    (0, typeorm_1.Column)("decimal", { precision: 10, scale: 2, default: 0 }),
    __metadata("design:type", Number)
], Pedido.prototype, "pago_motorizado", void 0);
__decorate([
    (0, typeorm_1.Column)("decimal", { precision: 10, scale: 2, default: 0 }),
    __metadata("design:type", Number)
], Pedido.prototype, "comision_moto_app", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)("UserMotorizado", { nullable: true }),
    __metadata("design:type", Object)
], Pedido.prototype, "motorizado", void 0);
__decorate([
    (0, typeorm_1.OneToMany)("ProductoPedido", (pp) => pp.pedido, { cascade: true }),
    __metadata("design:type", Array)
], Pedido.prototype, "productos", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], Pedido.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], Pedido.prototype, "updatedAt", void 0);
__decorate([
    (0, typeorm_1.Column)("decimal", { precision: 10, scale: 2, nullable: true }),
    __metadata("design:type", Object)
], Pedido.prototype, "distanciaKm", void 0);
__decorate([
    (0, typeorm_1.Column)("decimal", { precision: 10, scale: 6, nullable: true }),
    __metadata("design:type", Object)
], Pedido.prototype, "latCliente", void 0);
__decorate([
    (0, typeorm_1.Column)("decimal", { precision: 10, scale: 6, nullable: true }),
    __metadata("design:type", Object)
], Pedido.prototype, "lngCliente", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", nullable: true }),
    __metadata("design:type", Object)
], Pedido.prototype, "direccionTexto", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "int", default: 1 }),
    __metadata("design:type", Number)
], Pedido.prototype, "rondaAsignacion", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "timestamp", nullable: true }),
    __metadata("design:type", Object)
], Pedido.prototype, "fechaInicioRonda", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", nullable: true }),
    __metadata("design:type", Object)
], Pedido.prototype, "motorizadoEnEvaluacion", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "boolean", default: false }),
    __metadata("design:type", Boolean)
], Pedido.prototype, "asignacionBloqueada", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "int", default: 0 }),
    __metadata("design:type", Number)
], Pedido.prototype, "intentosEnRonda", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", nullable: true }),
    __metadata("design:type", Object)
], Pedido.prototype, "motivoCancelacion", void 0);
exports.Pedido = Pedido = __decorate([
    (0, typeorm_1.Entity)()
], Pedido);
