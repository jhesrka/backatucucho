import "reflect-metadata";
import { AppDataSource } from "./src/data/postgres/data-source";
import { Pedido } from "./src/data/postgres/models/Pedido";
import { Between } from "typeorm";
import moment from "moment-timezone";

async function check() {
    try {
        await AppDataSource.initialize();
        const start = moment.tz("2026-03-11", "America/Guayaquil").startOf('day').toDate();
        const end = moment.tz("2026-03-11", "America/Guayaquil").endOf('day').toDate();
        const count = await Pedido.countBy({ createdAt: Between(start, end) });
        console.log("COUNT:", count);
        await AppDataSource.destroy();
    } catch (error) {
        console.error(error);
    }
}
check();
