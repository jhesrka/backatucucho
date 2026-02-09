import { Negocio, User } from "./src/data";
import { DataSource } from "typeorm";
import { envs } from "./src/config";

const main = async () => {
    const ds = new DataSource({
        type: "postgres",
        host: envs.POSTGRES_HOST,
        port: envs.POSTGRES_PORT,
        username: envs.POSTGRES_USER,
        password: envs.POSTGRES_PASSWORD,
        database: envs.POSTGRES_DB,
        entities: [Negocio, User],
        synchronize: false,
    });

    await ds.initialize();
    console.log("DB Initialized");

    const businesses = await Negocio.find({
        where: [
            { nombre: "Gjhgvhgfj" },
            { nombre: "Zasfood" },
            { nombre: "La hueca parrillera" }
        ],
        relations: ["usuario"]
    });

    console.log(`Found ${businesses.length} businesses`);

    const owners = [...new Set(businesses.map(b => b.usuario?.email))];
    console.log("Owners found:", owners);

    for (const owner of owners) {
        if (!owner) continue;
        const user = await User.findOne({
            where: { email: owner },
            relations: ["negocios"]
        });
        console.log(`User ${owner} has ${user?.negocios?.length} businesses:`);
        user?.negocios?.forEach(n => {
            console.log(` - [${n.id}] ${n.nombre} (${n.statusNegocio}) ImageKey: ${n.imagenNegocio}`);
        });
    }

    await ds.destroy();
};

main().catch(console.error);
