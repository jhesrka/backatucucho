import { Request, Response } from 'express';
import { PushToken, User } from '../../data';
import { CustomError } from '../../domain';

export class NotificationController {
  constructor() {}

  private handleError = (error: unknown, res: Response) => {
    if (error instanceof CustomError) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    console.error('Unhandled error in NotificationController:', error);
    return res.status(500).json({ message: 'Internal server error' });
  };

  registerToken = async (req: Request, res: Response) => {
    try {
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
    } catch (error) {
      this.handleError(error, res);
    }
  };

  removeToken = async (req: Request, res: Response) => {
    try {
      const { token } = req.body;
      if (!token) throw CustomError.badRequest('Token is required');

      await PushToken.delete({ token });
      res.json({ message: 'Token removed successfully' });
    } catch (error) {
      this.handleError(error, res);
    }
  };

  registerTokenMotorizado = async (req: Request, res: Response) => {
    try {
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
    } catch (error) {
      this.handleError(error, res);
    }
  };

  removeTokenMotorizado = async (req: Request, res: Response) => {
    try {
      const { token } = req.body;
      if (!token) throw CustomError.badRequest('Token is required');

      await PushToken.delete({ token });
      res.json({ message: 'Token removed successfully' });
    } catch (error) {
      this.handleError(error, res);
    }
  };
}
