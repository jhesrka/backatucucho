import { AppDataSource } from "./data/postgres/postgres-database";
import { Negocio } from "./data/postgres/models/Negocio";

async function run() {
  await AppDataSource.initialize();
  const negocios = await Negocio.find();
  for (const n of negocios) {
    if (n.ordenAleatorioCategorias || n.ordenAleatorioProductos) {
      console.log(`Negocio ${n.id} (${n.nombre}): Categorias=${n.ordenAleatorioCategorias}, Productos=${n.ordenAleatorioProductos}`);
    }
  }
  process.exit(0);
}

run().catch(console.error);
