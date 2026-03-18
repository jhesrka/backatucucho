import "reflect-metadata";
import { AppDataSource } from "./src/data/postgres/data-source";

async function check() {
    try {
        await AppDataSource.initialize();
        const res = await AppDataSource.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'pedido' AND column_name IN ('createdAt', 'updatedAt');
        `);
        console.log(JSON.stringify(res, null, 2));
        await AppDataSource.destroy();
    } catch (error) {
        console.error(error);
    }
}
check();
