import "reflect-metadata";
import { AppDataSource } from "./src/data/postgres/data-source";
import { Pedido } from "./src/data/postgres/models/Pedido";

async function check() {
    try {
        await AppDataSource.initialize();
        const orders = await Pedido.find({
            order: { createdAt: "DESC" },
            take: 5,
            relations: ["cliente"]
        });
        console.log("Recent orders:");
        orders.forEach(o => {
            console.log(`ID: ${o.id}, Cliente: ${o.cliente?.id} (${o.cliente?.name}), CreatedAt (UTC): ${o.createdAt.toISOString()}`);
        });
        await AppDataSource.destroy();
    } catch (error) {
        console.error(error);
    }
}
check();
