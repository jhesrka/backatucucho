
import { AppDataSource } from "./src/data/postgres/data-source";
import { Negocio } from "./src/data/postgres/models/Negocio";

async function check() {
    await AppDataSource.initialize();
    const negocios = await Negocio.find({
        order: { created_at: 'DESC' },
        take: 5
    });

    console.log("Last 5 businesses:");
    negocios.forEach(n => {
        console.log(`ID: ${n.id} | Name: ${n.nombre}`);
        console.log(`Actual Key in DB: ${n.imagenNegocio}`);
        const isWebp = n.imagenNegocio.endsWith('.webp');
        console.log(`Is Optimized (webp): ${isWebp}`);
        console.log("-------------------");
    });

    await AppDataSource.destroy();
}

check();
