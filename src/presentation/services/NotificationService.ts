import * as admin from 'firebase-admin';
import { PushToken, Status } from '../../data';
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
    if (!userId) {
      console.warn('⚠️ Intentando enviar notificación pero el userId es inválido o vacío. Abortando para prevenir consulta masiva.');
      return;
    }

    if (!NotificationService.instance) {
      console.warn('⚠️ Intentando enviar notificación pero FCM no está inicializado.');
      return;
    }

    try {
      const tokens = await PushToken.find({ 
        where: [
          { user: { id: userId } },
          { motorizado: { id: userId } }
        ] 
      });
      if (tokens.length === 0) {
        console.log(`ℹ️ No hay tokens registrados para el usuario ${userId}. Saltando notificación.`);
        return;
      }

      const registrationTokens = tokens.map(t => t.token);

      const message: admin.messaging.MulticastMessage = {
        notification: { title, body },
        android: {
          priority: 'high',
          notification: { sound: 'default' }
        },
        apns: {
          payload: {
            aps: {
              contentAvailable: true,
              sound: 'default'
            }
          }
        },
        webpush: {
          headers: {
            Urgency: 'high'
          },
          notification: {
            icon: `${envs.WEBSERVICE_URL_FRONT}/logo_resized_192x192.png`,
            badge: `${envs.WEBSERVICE_URL_FRONT}/badge_96x96.png`
          }
        },
        data: {
          ...data,
          url: data.url || '/', // Para deep linking en la PWA
        },
        tokens: registrationTokens,
      };

      console.log(`📡 Enviando notificación push a ${registrationTokens.length} dispositivos del usuario ${userId}...`);
      const response = await admin.messaging().sendEachForMulticast(message);
      console.log(`✅ Resultado del envío: ${response.successCount} exitosos, ${response.failureCount} fallidos.`);
      
      // Limpiar tokens inválidos
      if (response.failureCount > 0) {
        const failedTokens: string[] = [];
        response.responses.forEach((resp, idx) => {
          if (!resp.success) {
            console.error(`❌ Error en token [${idx}]:`, resp.error?.code, resp.error?.message);
            const code = resp.error?.code;
            if (code === 'messaging/invalid-registration-token' || code === 'messaging/registration-token-not-registered') {
              failedTokens.push(registrationTokens[idx]);
            }
          }
        });
        
        if (failedTokens.length > 0) {
          console.log(`🧹 Limpiando ${failedTokens.length} tokens inválidos de la base de datos...`);
          await PushToken.createQueryBuilder()
            .delete()
            .where("token IN (:...tokens)", { tokens: failedTokens })
            .execute();
        }
      }
    } catch (error) {
      console.error('❌ Error crítico enviando notificación push:', error);
    }
  }

  async broadcastPushNotificationToAll(title: string, body: string, data: any = {}) {
    if (!NotificationService.instance) {
      console.warn('⚠️ Intentando hacer broadcast pero FCM no está inicializado.');
      return;
    }

    try {
      // 1. Obtener los tokens SOLO de los usuarios con estado ACTIVO
      const tokens = await PushToken.createQueryBuilder("push_token")
        .leftJoinAndSelect("push_token.user", "user")
        .where("user.status = :status", { status: Status.ACTIVE })
        .getMany();

      if (tokens.length === 0) {
        console.log(`ℹ️ No hay tokens registrados para usuarios activos. Saltando broadcast.`);
        return;
      }

      // Remover duplicados (un usuario podría tener el mismo token repetido por errores de frontend)
      const uniqueTokens = [...new Set(tokens.map(t => t.token))];

      console.log(`📡 Preparando envío masivo a ${uniqueTokens.length} dispositivos...`);

      // 2. Fragmentar en lotes de 500 (límite de Firebase sendEachForMulticast)
      const chunkSize = 500;
      let totalSuccess = 0;
      let totalFailed = 0;
      const failedTokens: string[] = [];

      for (let i = 0; i < uniqueTokens.length; i += chunkSize) {
        const chunk = uniqueTokens.slice(i, i + chunkSize);
        
        const message: admin.messaging.MulticastMessage = {
          notification: { title, body },
          android: {
            priority: 'high',
            notification: { sound: 'default' }
          },
          apns: {
            payload: { aps: { contentAvailable: true, sound: 'default' } }
          },
          webpush: {
            headers: { Urgency: 'high' },
            notification: {
              icon: `${envs.WEBSERVICE_URL_FRONT}/logo_resized_192x192.png`,
              badge: `${envs.WEBSERVICE_URL_FRONT}/badge_96x96.png`
            }
          },
          data: {
            ...data,
            url: data.url || '/', 
          },
          tokens: chunk,
        };

        const response = await admin.messaging().sendEachForMulticast(message);
        totalSuccess += response.successCount;
        totalFailed += response.failureCount;

        // Recolectar tokens fallidos de este lote
        if (response.failureCount > 0) {
          response.responses.forEach((resp, idx) => {
            if (!resp.success) {
              const code = resp.error?.code;
              if (code === 'messaging/invalid-registration-token' || code === 'messaging/registration-token-not-registered') {
                failedTokens.push(chunk[idx]);
              }
            }
          });
        }
      }

      console.log(`✅ Broadcast finalizado: ${totalSuccess} exitosos, ${totalFailed} fallidos.`);

      // 3. Limpiar base de datos de tokens inválidos globales
      if (failedTokens.length > 0) {
        console.log(`🧹 Limpiando ${failedTokens.length} tokens inválidos globales...`);
        // TypeORM delete in() falla con arreglos inmensos, fragmentar si es necesario (generalmente no superan mil)
        for(let j = 0; j < failedTokens.length; j += 500) {
          const deleteChunk = failedTokens.slice(j, j + 500);
          await PushToken.createQueryBuilder()
            .delete()
            .where("token IN (:...tokens)", { tokens: deleteChunk })
            .execute();
        }
      }

    } catch (error) {
      console.error('❌ Error crítico en broadcastPushNotificationToAll:', error);
    }
  }

  async sendToAdmins(title: string, body: string, data: any = {}) {
    if (!NotificationService.instance) {
      console.warn('⚠️ Intentando enviar a admins pero FCM no está inicializado.');
      return;
    }

    try {
      // Obtener tokens donde adminId no sea null
      const tokens = await PushToken.createQueryBuilder("push_token")
        .where("push_token.adminId IS NOT NULL")
        .getMany();

      if (tokens.length === 0) {
        console.log(`ℹ️ No hay tokens de administradores registrados. Saltando notificación.`);
        return;
      }

      const registrationTokens = tokens.map(t => t.token);

      const message: admin.messaging.MulticastMessage = {
        notification: { title, body },
        android: {
          priority: 'high',
          notification: { sound: 'default' }
        },
        apns: {
          payload: {
            aps: {
              contentAvailable: true,
              sound: 'default'
            }
          }
        },
        webpush: {
          headers: {
            Urgency: 'high'
          },
          notification: {
            icon: `${envs.WEBSERVICE_URL_FRONT}/logo_resized_192x192.png`,
            badge: `${envs.WEBSERVICE_URL_FRONT}/badge_96x96.png`
          }
        },
        data: {
          ...data,
          url: data.url || '/admin', // deep link al dashboard admin
        },
        tokens: registrationTokens,
      };

      console.log(`📡 Enviando notificación push a ${registrationTokens.length} administradores...`);
      const response = await admin.messaging().sendEachForMulticast(message);
      console.log(`✅ Resultado del envío a admins: ${response.successCount} exitosos, ${response.failureCount} fallidos.`);

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
          console.log(`🧹 Limpiando ${failedTokens.length} tokens inválidos de admins...`);
          await PushToken.createQueryBuilder()
            .delete()
            .where("token IN (:...tokens)", { tokens: failedTokens })
            .execute();
        }
      }
    } catch (error) {
      console.error('❌ Error crítico enviando notificación push a administradores:', error);
    }
  }
}
