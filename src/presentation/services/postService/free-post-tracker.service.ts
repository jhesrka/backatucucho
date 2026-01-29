import { FreePostTracker, User } from "../../../data";
import { CustomError } from "../../../domain";

export class FreePostTrackerService {
  async getOrCreateTracker(userId: string): Promise<FreePostTracker> {
    const currentMonth = new Date();
    currentMonth.setDate(1); // Primer día del mes
    currentMonth.setHours(0, 0, 0, 0);

    // Usa findOneBy en lugar de findOne
    let tracker = await FreePostTracker.findOneBy({
      user: { id: userId },
      monthYear: currentMonth
    });

    if (!tracker) {
      const user = await User.findOneBy({ id: userId });
      if (!user) {
        throw CustomError.notFound("Usuario no encontrado");
      }

      tracker = new FreePostTracker();
      tracker.user = user;
      tracker.monthYear = currentMonth;
      tracker.count = 0;
      await tracker.save();
    }

    return tracker;
  }
}