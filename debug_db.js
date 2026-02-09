
const { Client } = require('pg');

const client = new Client({
    host: 'ep-shrill-voice-a5t0b4r1-pooler.us-east-2.aws.neon.tech',
    user: 'atucucho_owner',
    password: 'npg_mgK1vlMTO2Yq',
    database: 'atucucho',
    port: 5432,
    ssl: { rejectUnauthorized: false }
});

async function run() {
    try {
        await client.connect();
        console.log("Connected to DB");

        // Check tables
        // const resTables = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public'");
        // console.log("Tables:", resTables.rows.map(r => r.table_name));

        const businessId = '36a53408-4d75-4f96-928b-a8ffb840e753';

        // Check Orders
        // Usually table snake_case 'pedido'
        const query = `
        SELECT id, "estado", "negocioId", "createdAt", "total" 
        FROM "pedido" 
        WHERE "negocioId" = $1 
        ORDER BY "createdAt" DESC
    `;

        // Note: TypeORM might use camelCase columns if not configured as snake_case. 
        // And relations might be `negocioId` or `negocio_id`.
        // I'll try generic select first.

        const res = await client.query('SELECT * FROM "pedido" WHERE "negocioId" = $1', [businessId]);
        console.log(`Found ${res.rows.length} orders for business ${businessId}`);

        if (res.rows.length > 0) {
            res.rows.forEach(r => {
                console.log(`Order ${r.id}: Status=${r.estado}`);
            });
        } else {
            // Try snake_case foreign key
            console.log("No orders found with 'negocioId'. Trying 'negocio_id'...");
            try {
                const res2 = await client.query('SELECT * FROM "pedido" WHERE "negocio_id" = $1', [businessId]);
                console.log(`Found ${res2.rows.length} orders with negocio_id`);
                res2.rows.forEach(r => {
                    console.log(`Order ${r.id}: Status=${r.estado}`);
                });
            } catch (e) {
                console.log("Error querying negocio_id:", e.message);
            }
        }

    } catch (e) {
        console.error("Error:", e);
    } finally {
        await client.end();
    }
}

run();
