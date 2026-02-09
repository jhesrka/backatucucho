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
exports.UserMotorizado = exports.EstadoTrabajoMotorizado = exports.EstadoCuentaMotorizado = void 0;
const typeorm_1 = require("typeorm");
const config_1 = require("../../../config");
const Pedido_1 = require("./Pedido");
// 🔹 Estado administrativo del motorizado
var EstadoCuentaMotorizado;
(function (EstadoCuentaMotorizado) {
    EstadoCuentaMotorizado["ACTIVO"] = "ACTIVO";
    EstadoCuentaMotorizado["PENDIENTE"] = "PENDIENTE";
    EstadoCuentaMotorizado["BLOQUEADO"] = "BLOQUEADO";
    EstadoCuentaMotorizado["ELIMINADO"] = "ELIMINADO";
})(EstadoCuentaMotorizado || (exports.EstadoCuentaMotorizado = EstadoCuentaMotorizado = {}));
// 🔹 Estado operativo del motorizado
var EstadoTrabajoMotorizado;
(function (EstadoTrabajoMotorizado) {
    EstadoTrabajoMotorizado["DISPONIBLE"] = "DISPONIBLE";
    EstadoTrabajoMotorizado["EN_EVALUACION"] = "EN_EVALUACION";
    EstadoTrabajoMotorizado["ENTREGANDO"] = "ENTREGANDO";
    EstadoTrabajoMotorizado["NO_TRABAJANDO"] = "NO_TRABAJANDO";
})(EstadoTrabajoMotorizado || (exports.EstadoTrabajoMotorizado = EstadoTrabajoMotorizado = {}));
let UserMotorizado = class UserMotorizado extends typeorm_1.BaseEntity {
    encryptedPassword() {
        this.password = config_1.encriptAdapter.hash(this.password);
    }
};
exports.UserMotorizado = UserMotorizado;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)("uuid"),
    __metadata("design:type", String)
], UserMotorizado.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)("varchar", { length: 80 }),
    __metadata("design:type", String)
], UserMotorizado.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)("varchar", { length: 80 }),
    __metadata("design:type", String)
], UserMotorizado.prototype, "surname", void 0);
__decorate([
    (0, typeorm_1.Column)("varchar", { length: 10, unique: true }),
    __metadata("design:type", String)
], UserMotorizado.prototype, "whatsapp", void 0);
__decorate([
    (0, typeorm_1.Column)("varchar", { length: 10, unique: true }),
    __metadata("design:type", String)
], UserMotorizado.prototype, "cedula", void 0);
__decorate([
    (0, typeorm_1.Column)("varchar"),
    __metadata("design:type", String)
], UserMotorizado.prototype, "password", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 0 }),
    __metadata("design:type", Number)
], UserMotorizado.prototype, "tokenVersion", void 0);
__decorate([
    (0, typeorm_1.Column)("decimal", { precision: 10, scale: 2, default: 0 }),
    __metadata("design:type", Number)
], UserMotorizado.prototype, "saldo", void 0);
__decorate([
    (0, typeorm_1.Column)("varchar", { nullable: true }),
    __metadata("design:type", Object)
], UserMotorizado.prototype, "bancoNombre", void 0);
__decorate([
    (0, typeorm_1.Column)("varchar", { nullable: true }),
    __metadata("design:type", Object)
], UserMotorizado.prototype, "bancoTipoCuenta", void 0);
__decorate([
    (0, typeorm_1.Column)("varchar", { nullable: true }),
    __metadata("design:type", Object)
], UserMotorizado.prototype, "bancoNumeroCuenta", void 0);
__decorate([
    (0, typeorm_1.Column)("varchar", { nullable: true }),
    __metadata("design:type", Object)
], UserMotorizado.prototype, "bancoTitular", void 0);
__decorate([
    (0, typeorm_1.Column)("varchar", { nullable: true }),
    __metadata("design:type", Object)
], UserMotorizado.prototype, "bancoIdentificacion", void 0);
__decorate([
    (0, typeorm_1.Column)("enum", {
        enum: EstadoCuentaMotorizado,
        default: EstadoCuentaMotorizado.PENDIENTE,
    }),
    __metadata("design:type", String)
], UserMotorizado.prototype, "estadoCuenta", void 0);
__decorate([
    (0, typeorm_1.Column)("enum", {
        enum: EstadoTrabajoMotorizado,
        default: EstadoTrabajoMotorizado.NO_TRABAJANDO,
    }),
    __metadata("design:type", String)
], UserMotorizado.prototype, "estadoTrabajo", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "boolean", default: false }),
    __metadata("design:type", Boolean)
], UserMotorizado.prototype, "quiereTrabajar", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "timestamp", nullable: true }),
    __metadata("design:type", Object)
], UserMotorizado.prototype, "noDisponibleHasta", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "timestamp", nullable: true }),
    __metadata("design:type", Object)
], UserMotorizado.prototype, "fechaHoraDisponible", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ type: "timestamp" }),
    __metadata("design:type", Date)
], UserMotorizado.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.Column)("int", { default: 0 }),
    __metadata("design:type", Number)
], UserMotorizado.prototype, "resetTokenVersion", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => Pedido_1.Pedido, (pedido) => pedido.motorizado),
    __metadata("design:type", Array)
], UserMotorizado.prototype, "pedidos", void 0);
__decorate([
    (0, typeorm_1.OneToMany)("TransaccionMotorizado", (trans) => trans.motorizado),
    __metadata("design:type", Array)
], UserMotorizado.prototype, "transacciones", void 0);
__decorate([
    (0, typeorm_1.BeforeInsert)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], UserMotorizado.prototype, "encryptedPassword", null);
exports.UserMotorizado = UserMotorizado = __decorate([
    (0, typeorm_1.Entity)()
], UserMotorizado);
