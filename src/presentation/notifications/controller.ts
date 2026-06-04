import { Request, Response } from 'express';
import { PushToken, User } from '../../data';
import { CustomError } from '../../domain';

export class NotificationController {
  constructor() {}

  registerToken = async (req: Request, res: Response) => {
    const { token, deviceType } = req.body;
    const userId = req.body.sessionUser.id;

    if (!token) throw CustomError.badRequest('Token is required');

    const user = await User.findOneBy({ id: userId });
    if (!user) throw CustomError.notFound('User not found');

    // Buscar si el token ya existe
    let pushToken = await PushToken.findOneBy({ token });

    if (pushToken) {
      pushToken.user = user;
      pushToken.deviceType = deviceType || pushToken.deviceType;
      await pushToken.save();
    } else {
      pushToken = PushToken.create({
        token,
        deviceType,
        user
      });
      await pushToken.save();
    }

    res.json({ message: 'Token registered successfully' });
  };

  removeToken = async (req: Request, res: Response) => {
    const { token } = req.body;
    if (!token) throw CustomError.badRequest('Token is required');

    await PushToken.delete({ token });
    res.json({ message: 'Token removed successfully' });
  };

  registerTokenMotorizado = async (req: Request, res: Response) => {
    const { token, deviceType } = req.body;
    const motorizadoId = req.body.sessionUser.id; // From AuthMotorizadoMiddleware

    if (!token) throw CustomError.badRequest('Token is required');

    const UserMotorizado = require('../../data').UserMotorizado;
    const motorizado = await UserMotorizado.findOneBy({ id: motorizadoId });
    if (!motorizado) throw CustomError.notFound('Motorizado not found');

    let pushToken = await PushToken.findOneBy({ token });

    if (pushToken) {
      pushToken.motorizado = motorizado;
      pushToken.deviceType = deviceType || pushToken.deviceType;
      await pushToken.save();
    } else {
      pushToken = PushToken.create({
        token,
        deviceType,
        motorizado
      });
      await pushToken.save();
    }

    res.json({ message: 'Token registered successfully for motorizado' });
  };

  removeTokenMotorizado = async (req: Request, res: Response) => {
    const { token } = req.body;
    if (!token) throw CustomError.badRequest('Token is required');

    await PushToken.delete({ token });
    res.json({ message: 'Token removed successfully' });
  };
}
