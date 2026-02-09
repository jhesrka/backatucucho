
require('dotenv').config();
const { Client } = require('pg');
const jwt = require('jsonwebtoken');

const client = new Client({
    host: process.env.HOST_DATABASE,
    port: process.env.PORT_DATABASE,
    user: process.env.USERNAME_DATABASE,
    password: process.env.PASSWORD_DATABASE,
    database: process.env.DATABASE,
    ssl: { rejectUnauthorized: false }
});

const businessId = '36a53408-4d75-4f96-928b-a8ffb840e753';

(async () => {
    try {
        await client.connect();
        const res = await client.query(`SELECT "usuarioId" FROM negocio WHERE id = '${businessId}'`);
        const userId = res.rows[0]?.usuarioId;
        const seed = process.env.JWT_SEED;
        const token = jwt.sign({ id: userId }, seed, { expiresIn: '1h' });
        await client.query(`UPDATE "user" SET "currentSessionId" = '${token}', "isLoggedIn" = true WHERE id = '${userId}'`);

        const url = `http://localhost:3000/api/business/${businessId}/orders?status=PENDIENTE,ACEPTADO&limit=50`;
        console.log(`Fetching: ${url}`);

        const response = await fetch(url, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        console.log("Status:", response.status);
        const text = await response.text();
        console.log("Body Start:", text.substring(0, 300));

    } catch (error) {
        console.error("❌ Error:", error);
    } finally {
        await client.end();
    }
})();
