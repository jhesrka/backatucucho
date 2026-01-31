
const { DataSource } = require("typeorm");
const { GlobalSettings } = require("./src/data/postgres/models/global-settings.model");

async function check() {
    const ds = new DataSource({
        type: "postgres",
        host: "localhost",
        port: 5432,
        username: "postgres",
        password: process.env.DB_PASSWORD || "postgres",
        database: "atucucho_db",
        entities: [GlobalSettings]
    });
    try {
        await ds.initialize();
        const settings = await ds.getRepository(GlobalSettings).findOne({ where: {} });
        console.log("CURRENT_VERSION_IN_DB:", settings?.currentTermsVersion);
        await ds.destroy();
    } catch (e) {
        console.error(e);
    }
}
check();
