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
        
        console.log("Checking orders between:", start.toISOString(), "and", end.toISOString());

        const orders = await Pedido.find({
            where: {
                createdAt: Between(start, end)
            },
            relations: ["cliente"]
        });
        
        console.log(`Found ${orders.length} orders for today (EC).`);
        orders.forEach(o => {
            console.log(`ID: ${o.id}, Cliente: ${o.cliente?.id}, CreatedAt (UTC): ${o.createdAt.toISOString()}`);
        });

        await AppDataSource.destroy();
    } catch (error) {
        console.error(error);
    }
}
check();
