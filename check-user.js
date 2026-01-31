
const { DataSource } = require("typeorm");
const { User } = require("./src/data/postgres/models/user.model");
const { GlobalSettings } = require("./src/data/postgres/models/global-settings.model");

async function check() {
    const ds = new DataSource({
        type: "postgres",
        host: "ep-shrill-voice-a5t0b4r1-pooler.us-east-2.aws.neon.tech",
        port: 5432,
        username: "atucucho_owner",
        password: "npg_mgK1vlMTO2Yq",
        database: "atucucho",
        ssl: true,
        entities: [User, GlobalSettings]
    });
    try {
        await ds.initialize();
        const user = await ds.getRepository(User).findOne({ where: { email: "jhesrka@hotmail.com" } });
        const settings = await ds.getRepository(GlobalSettings).findOne({ where: {} });

        console.log("USER_DATA:", {
            email: user?.email,
            whatsapp: user?.whatsapp,
            photoperfil: user?.photoperfil,
            acceptedTermsVersion: user?.acceptedTermsVersion,
            acceptedPrivacyVersion: user?.acceptedPrivacyVersion,
            hasPassword: !!user?.password
        });
        console.log("SYSTEM_VERSION:", settings?.currentTermsVersion);

        await ds.destroy();
    } catch (e) {
        console.error(e);
    }
}
check();
