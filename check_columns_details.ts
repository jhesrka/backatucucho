import "reflect-metadata";
import { AppDataSource } from "./src/data/postgres/data-source";
import { Pedido } from "./src/data/postgres/models/Pedido";

async function check() {
    try {
        await AppDataSource.initialize();
        const columns = AppDataSource.getMetadata(Pedido).columns;
        for (const col of columns) {
            console.log(`Prop: ${col.propertyName}, DB: ${col.databaseName}`);
        }
        await AppDataSource.destroy();
    } catch (error) {
        console.error(error);
    }
}
check();
