"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.InitialSchema1769895317470 = void 0;
class InitialSchema1769895317470 {
    constructor() {
        this.name = 'InitialSchema1769895317470';
    }
    up(queryRunner) {
        return __awaiter(this, void 0, void 0, function* () {
            yield queryRunner.query(`DROP INDEX "public"."IDX_recharge_approved_unique"`);
            yield queryRunner.query(`ALTER TABLE "pedido" ALTER COLUMN "costoEnvio" SET DEFAULT '1.25'`);
            yield queryRunner.query(`ALTER TABLE "price_settings" ALTER COLUMN "extraDayPrice" SET DEFAULT '0.25'`);
            yield queryRunner.query(`ALTER TABLE "delivery_settings" ALTER COLUMN "firstRangeFee" SET DEFAULT '1.25'`);
            yield queryRunner.query(`ALTER TABLE "delivery_settings" ALTER COLUMN "extraStepFee" SET DEFAULT '0.25'`);
        });
    }
    down(queryRunner) {
        return __awaiter(this, void 0, void 0, function* () {
            yield queryRunner.query(`ALTER TABLE "delivery_settings" ALTER COLUMN "extraStepFee" SET DEFAULT 0.25`);
            yield queryRunner.query(`ALTER TABLE "delivery_settings" ALTER COLUMN "firstRangeFee" SET DEFAULT 1.25`);
            yield queryRunner.query(`ALTER TABLE "price_settings" ALTER COLUMN "extraDayPrice" SET DEFAULT 0.25`);
            yield queryRunner.query(`ALTER TABLE "pedido" ALTER COLUMN "costoEnvio" SET DEFAULT 1.25`);
            yield queryRunner.query(`CREATE UNIQUE INDEX "IDX_recharge_approved_unique" ON "recharge_requests" ("bank_name", "receipt_number", "transaction_date") WHERE (status = 'APROBADO'::recharge_requests_status_enum)`);
        });
    }
}
exports.InitialSchema1769895317470 = InitialSchema1769895317470;
