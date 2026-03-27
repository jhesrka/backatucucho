
import { AppDataSource } from "../src/data/postgres/postgres-database";
import { Negocio } from "../src/data/postgres/models/Negocio";
import { envs } from "../src/config/env";

async function investigate() {
  await AppDataSource.initialize();
  
  const negocio = await Negocio.findOne({
    where: { nombre: "LA HUECA PARRILLERA" }
  });
  
  console.log("DATOS DE LA HUECA:", {
    id: negocio?.id,
    nombre: negocio?.nombre,
    habilitado_admin: negocio?.pago_tarjeta_habilitado_admin,
    activo_negocio: negocio?.pago_tarjeta_activo_negocio,
    store_id: negocio?.payphone_store_id,
    token_present: !!negocio?.payphone_token,
    token_length: negocio?.payphone_token?.length,
    recargo: negocio?.porcentaje_recargo_tarjeta
  });
  
  process.exit(0);
}

investigate();
