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
exports.TransaccionMotorizado = exports.EstadoTransaccion = exports.TipoTransaccion = void 0;
const typeorm_1 = require("typeorm");
var TipoTransaccion;
(function (TipoTransaccion) {
    TipoTransaccion["GANANCIA_ENVIO"] = "GANANCIA_ENVIO";
    TipoTransaccion["RETIRO"] = "RETIRO";
    TipoTransaccion["AJUSTE"] = "AJUSTE";
})(TipoTransaccion || (exports.TipoTransaccion = TipoTransaccion = {}));
var EstadoTransaccion;
(function (EstadoTransaccion) {
    EstadoTransaccion["COMPLETADA"] = "COMPLETADA";
    EstadoTransaccion["PENDIENTE"] = "PENDIENTE";
    EstadoTransaccion["RECHAZADA"] = "RECHAZADA";
})(EstadoTransaccion || (exports.EstadoTransaccion = EstadoTransaccion = {}));
let TransaccionMotorizado = class TransaccionMotorizado extends typeorm_1.BaseEntity {
};
exports.TransaccionMotorizado = TransaccionMotorizado;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)("uuid"),
    __metadata("design:type", String)
], TransaccionMotorizado.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)("UserMotorizado", (user) => user.transacciones),
    __metadata("design:type", Function)
], TransaccionMotorizado.prototype, "motorizado", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)("Pedido", { nullable: true }),
    __metadata("design:type", Object)
], TransaccionMotorizado.prototype, "pedido", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "enum", enum: TipoTransaccion }),
    __metadata("design:type", String)
], TransaccionMotorizado.prototype, "tipo", void 0);
__decorate([
    (0, typeorm_1.Column)("decimal", { precision: 10, scale: 2 }),
    __metadata("design:type", Number)
], TransaccionMotorizado.prototype, "monto", void 0);
__decorate([
    (0, typeorm_1.Column)("varchar", { nullable: true }),
    __metadata("design:type", String)
], TransaccionMotorizado.prototype, "descripcion", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], TransaccionMotorizado.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "enum", enum: EstadoTransaccion, default: EstadoTransaccion.COMPLETADA }),
    __metadata("design:type", String)
], TransaccionMotorizado.prototype, "estado", void 0);
__decorate([
    (0, typeorm_1.Column)("decimal", { precision: 10, scale: 2, nullable: true }),
    __metadata("design:type", Number)
], TransaccionMotorizado.prototype, "saldoAnterior", void 0);
__decorate([
    (0, typeorm_1.Column)("decimal", { precision: 10, scale: 2, nullable: true }),
    __metadata("design:type", Number)
], TransaccionMotorizado.prototype, "saldoNuevo", void 0);
__decorate([
    (0, typeorm_1.Column)("text", { nullable: true }),
    __metadata("design:type", Object)
], TransaccionMotorizado.prototype, "detalles", void 0);
exports.TransaccionMotorizado = TransaccionMotorizado = __decorate([
    (0, typeorm_1.Entity)()
], TransaccionMotorizado);
