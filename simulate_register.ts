
import { AppDataSource } from "./src/data/postgres/data-source";
import { User, Wallet, Subscription, SubscriptionPlan, SubscriptionStatus } from "./src/data";
import { FreePostTrackerService } from "./src/presentation/services/postService/free-post-tracker.service";

async function simulateRegister() {
    await AppDataSource.initialize();

    const user = new User();
    user.name = "test";
    user.surname = "user";
    user.email = "test" + Date.now() + "@test.com";
    user.password = "Clave123#";
    user.birthday = new Date("1990-01-01");
    user.whatsapp = "0987654321";

    const wallet = new Wallet();
    wallet.balance = 0;
    user.wallet = wallet;

    try {
        console.log("Saving user...");
        const newUser = await user.save();
        console.log("User saved with ID:", newUser.id);

        const subscription = new Subscription();
        subscription.user = newUser;
        subscription.plan = SubscriptionPlan.BASIC;
        subscription.status = SubscriptionStatus.PENDIENTE;
        subscription.startDate = new Date();
        subscription.endDate = null!;

        console.log("Creating tracker...");
        const freePostTrackerService = new FreePostTrackerService();
        await freePostTrackerService.getOrCreateTracker(newUser.id);

        console.log("Saving subscription...");
        await subscription.save();

        console.log("Success!");
    } catch (error) {
        console.error("Simulation failed:", error);
    } finally {
        await AppDataSource.destroy();
    }
}

simulateRegister();
