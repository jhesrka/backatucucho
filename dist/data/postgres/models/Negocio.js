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
exports.Negocio = exports.EstadoNegocio = exports.ModeloMonetizacion = exports.StatusNegocio = void 0;
const typeorm_1 = require("typeorm");
const CategoriaNegocio_1 = require("./CategoriaNegocio");
const user_model_1 = require("./user.model");
const BalanceNegocio_1 = require("./BalanceNegocio");
const Producto_1 = require("./Producto");
const Pedido_1 = require("./Pedido");
const TipoProducto_1 = require("./TipoProducto");
var StatusNegocio;
(function (StatusNegocio) {
    StatusNegocio["PENDIENTE"] = "PENDIENTE";
    StatusNegocio["ACTIVO"] = "ACTIVO";
    StatusNegocio["SUSPENDIDO"] = "SUSPENDIDO";
    StatusNegocio["BLOQUEADO"] = "BLOQUEADO";
    StatusNegocio["NO_PAGADO"] = "NO_PAGADO";
})(StatusNegocio || (exports.StatusNegocio = StatusNegocio = {}));
var ModeloMonetizacion;
(function (ModeloMonetizacion) {
    ModeloMonetizacion["SUSCRIPCION"] = "SUSCRIPCION";
    ModeloMonetizacion["COMISION_SUSCRIPCION"] = "COMISION_SUSCRIPCION";
})(ModeloMonetizacion || (exports.ModeloMonetizacion = ModeloMonetizacion = {}));
var EstadoNegocio;
(function (EstadoNegocio) {
    EstadoNegocio["ABIERTO"] = "ABIERTO";
    EstadoNegocio["CERRADO"] = "CERRADO";
})(EstadoNegocio || (exports.EstadoNegocio = EstadoNegocio = {}));
let Negocio = class Negocio extends typeorm_1.BaseEntity {
};
exports.Negocio = Negocio;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)("uuid"),
    __metadata("design:type", String)
], Negocio.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", nullable: false, length: 100, unique: true }),
    __metadata("design:type", String)
], Negocio.prototype, "nombre", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "text", nullable: false }),
    __metadata("design:type", String)
], Negocio.prototype, "descripcion", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: "varchar",
        nullable: true,
        default: "ImgStore/imagenrota.jpg",
    }),
    __metadata("design:type", String)
], Negocio.prototype, "imagenNegocio", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: "enum",
        enum: StatusNegocio,
        default: StatusNegocio.PENDIENTE,
    }),
    __metadata("design:type", String)
], Negocio.prototype, "statusNegocio", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: "enum",
        enum: ModeloMonetizacion,
        nullable: false,
    }),
    __metadata("design:type", String)
], Negocio.prototype, "modeloMonetizacion", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: "enum",
        enum: EstadoNegocio,
        default: EstadoNegocio.CERRADO,
    }),
    __metadata("design:type", String)
], Negocio.prototype, "estadoNegocio", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "decimal", precision: 10, scale: 2, default: 0 }),
    __metadata("design:type", Number)
], Negocio.prototype, "valorSuscripcion", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "int", default: 1 }),
    __metadata("design:type", Number)
], Negocio.prototype, "diaPago", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "timestamp", nullable: true }),
    __metadata("design:type", Object)
], Negocio.prototype, "fechaUltimoCobro", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "timestamp", nullable: true }),
    __metadata("design:type", Object)
], Negocio.prototype, "fechaInicioSuscripcion", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "timestamp", nullable: true }),
    __metadata("design:type", Object)
], Negocio.prototype, "fechaFinSuscripcion", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "int", default: 0 }),
    __metadata("design:type", Number)
], Negocio.prototype, "intentosCobro", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ type: "timestamp" }),
    __metadata("design:type", Date)
], Negocio.prototype, "created_at", void 0);
__decorate([
    (0, typeorm_1.Column)("decimal", { precision: 10, scale: 6, nullable: true }),
    __metadata("design:type", Object)
], Negocio.prototype, "latitud", void 0);
__decorate([
    (0, typeorm_1.Column)("decimal", { precision: 10, scale: 6, nullable: true }),
    __metadata("design:type", Object)
], Negocio.prototype, "longitud", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 200, nullable: true }),
    __metadata("design:type", Object)
], Negocio.prototype, "direccionTexto", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 100, nullable: true }),
    __metadata("design:type", Object)
], Negocio.prototype, "banco", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 50, nullable: true }),
    __metadata("design:type", Object)
], Negocio.prototype, "tipoCuenta", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 50, nullable: true }),
    __metadata("design:type", Object)
], Negocio.prototype, "numeroCuenta", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 100, nullable: true }),
    __metadata("design:type", Object)
], Negocio.prototype, "titularCuenta", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ type: "timestamptz" }),
    __metadata("design:type", Date)
], Negocio.prototype, "updated_at", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => user_model_1.User, (user) => user.negocios),
    __metadata("design:type", user_model_1.User)
], Negocio.prototype, "usuario", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => CategoriaNegocio_1.CategoriaNegocio, (cat) => cat.negocios),
    __metadata("design:type", CategoriaNegocio_1.CategoriaNegocio)
], Negocio.prototype, "categoria", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => Producto_1.Producto, (producto) => producto.negocio, { cascade: true }),
    __metadata("design:type", Array)
], Negocio.prototype, "productos", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => Pedido_1.Pedido, (pedido) => pedido.negocio),
    __metadata("design:type", Array)
], Negocio.prototype, "pedidos", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => TipoProducto_1.TipoProducto, (tipo) => tipo.negocio, { cascade: true }),
    __metadata("design:type", Array)
], Negocio.prototype, "tipos", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => BalanceNegocio_1.BalanceNegocio, (balance) => balance.negocio),
    __metadata("design:type", Array)
], Negocio.prototype, "balances", void 0);
exports.Negocio = Negocio = __decorate([
    (0, typeorm_1.Entity)()
], Negocio);
