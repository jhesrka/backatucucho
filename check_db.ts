import { createConnection } from "typeorm";
import { Pedido } from "./src/data/postgres/models/Pedido";
import { envs } from "./src/config/env";

async function run() {
    await createConnection({
        type: "postgres",
        url: envs.POSTGRES_URL,
        entities: [Pedido],
        synchronize: false
    });
    
    // Find order ending in 8219CE
    const orders = await Pedido.find();
    const order = orders.find(o => o.id.toUpperCase().endsWith("8219CE"));
    
    if (order) {
        console.log(JSON.stringify(order, null, 2));
    } else {
        console.log("Order not found");
    }
    process.exit(0);
}
run();
