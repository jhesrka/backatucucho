
const { Client } = require('pg');

async function check() {
    const client = new Client({
        connectionString: "postgres://atucucho_owner:npg_mgK1vlMTO2Yq@ep-shrill-voice-a5t0b4r1-pooler.us-east-2.aws.neon.tech/atucucho?sslmode=require"
    });
    try {
        await client.connect();
        const userRes = await client.query("SELECT email, whatsapp, photoperfil, \"acceptedTermsVersion\", \"acceptedPrivacyVersion\", password FROM \"user\" WHERE email = 'jhesrka@hotmail.com'");
        const settingsRes = await client.query("SELECT \"currentTermsVersion\" FROM global_settings LIMIT 1");

        console.log("USER_DATA:", userRes.rows[0] ? {
            ...userRes.rows[0],
            password: userRes.rows[0].password ? 'SET' : 'NULL'
        } : 'NOT FOUND');
        console.log("SYSTEM_VERSION:", settingsRes.rows[0]?.currentTermsVersion);

        await client.end();
    } catch (e) {
        console.error(e);
    }
}
check();
