
import { AppDataSource } from "./src/data/postgres/data-source";
import { UserService } from "./src/presentation/services/usuario/user.service";
import { EmailService } from "./src/presentation/services/email.service";
import { CreateUserDTO } from "./src/domain";
import { envs } from "./src/config";

async function testService() {
    await AppDataSource.initialize();

    // Mock EmailService
    const emailService = new EmailService(
        envs.MAILER_SERVICE,
        envs.MAILER_EMAIL,
        envs.MAILER_SECRET_KEY,
        envs.SEND_EMAIL
    );

    const userService = new UserService(emailService);

    const [err, dto] = CreateUserDTO.create({
        name: "test",
        surname: "user",
        email: "test" + Date.now() + "@test.com",
        password: "Clave123#",
        birthday: "1990-01-01",
        whatsapp: "09" + Math.floor(Math.random() * 100000000),
        acceptedTerms: true,
        acceptedPrivacy: true
    });

    try {
        console.log("Calling userService.createUser...");
        const result = await userService.createUser(dto!);
        console.log("Result:", result);
    } catch (error) {
        console.error("Test failed:", error);
    } finally {
        await AppDataSource.destroy();
    }
}

testService();
