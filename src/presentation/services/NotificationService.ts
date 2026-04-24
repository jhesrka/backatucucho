import * as admin from 'firebase-admin';
import { PushToken } from '../../data';
import { envs } from '../../config';

export class NotificationService {
  private static instance: boolean = false;

  constructor() {
    if (!NotificationService.instance) {
      let serviceAccount = envs.FIREBASE_SERVICE_ACCOUNT; 
      if (serviceAccount) {
        try {
          // Limpiar posibles comillas del .env
          if (serviceAccount.startsWith("'") && serviceAccount.endsWith("'")) {
            serviceAccount = serviceAccount.slice(1, -1);
          }

          // Si el serviceAccount viene como string base64 o JSON directo
          const cert = serviceAccount.trim().startsWith('{') 
            ? JSON.parse(serviceAccount) 
            : JSON.parse(Buffer.from(serviceAccount, 'base64').toString());

          admin.initializeApp({
            credential: admin.credential.cert(cert),
          });
          NotificationService.instance = true;
          console.log('🚀 FCM Initialized');
        } catch (error) {
          console.error('❌ Error initializing FCM. Check if FIREBASE_SERVICE_ACCOUNT is a valid JSON or Base64 string.');
          console.error(error);
        }
      } else {
        console.warn('⚠️ FIREBASE_SERVICE_ACCOUNT not found in env. Push notifications will be disabled.');
      }
    }
  }

  async sendPushNotification(userId: string, title: string, body: string, data: any = {}) {
    if (!NotificationService.instance) return;

    try {
      const tokens = await PushToken.find({ where: { user: { id: userId } } });
      if (tokens.length === 0) return;

      const registrationTokens = tokens.map(t => t.token);

      const message: admin.messaging.MulticastMessage = {
        notification: { title, body },
        data: {
          ...data,
          url: data.url || '/', // Para deep linking en la PWA
        },
        tokens: registrationTokens,
      };

      const response = await admin.messaging().sendEachForMulticast(message);
      
      // Limpiar tokens inválidos
      if (response.failureCount > 0) {
        const failedTokens: string[] = [];
        response.responses.forEach((resp, idx) => {
          if (!resp.success) {
            const code = resp.error?.code;
            if (code === 'messaging/invalid-registration-token' || code === 'messaging/registration-token-not-registered') {
              failedTokens.push(registrationTokens[idx]);
            }
          }
        });
        
        if (failedTokens.length > 0) {
          await PushToken.createQueryBuilder()
            .delete()
            .where("token IN (:...tokens)", { tokens: failedTokens })
            .execute();
        }
      }
    } catch (error) {
      console.error('❌ Error sending push notification:', error);
    }
  }
}
