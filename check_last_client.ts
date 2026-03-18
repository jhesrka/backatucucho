import "reflect-metadata";
import { AppDataSource } from "./src/data/postgres/data-source";
import { Pedido } from "./src/data/postgres/models/Pedido";

async function check() {
    try {
        await AppDataSource.initialize();
        const order = await Pedido.findOne({
            where: {},
            order: { createdAt: "DESC" },
            relations: ["cliente"]
        });
        if (order) {
            console.log("LAST ORDER CLIENT ID:", order.cliente?.id);
        } else {
            console.log("NO ORDERS");
        }
        await AppDataSource.destroy();
    } catch (error) {
        console.error(error);
    }
}
check();
