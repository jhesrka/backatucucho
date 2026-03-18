import "reflect-metadata";
import { AppDataSource } from "./src/data/postgres/data-source";
import { Pedido } from "./src/data/postgres/models/Pedido";

async function check() {
    try {
        await AppDataSource.initialize();
        const columns = AppDataSource.getMetadata(Pedido).columns.map(c => c.databaseName);
        console.log("Columns:", columns.join(", "));
        await AppDataSource.destroy();
    } catch (error) {
        console.error(error);
    }
}
check();
