import * as admin from 'firebase-admin';
import { PushToken, Status, Campaign, CampaignType, CampaignStatus } from '../../data';
import { envs } from '../../config';
import { UploadFilesCloud } from '../../config/upload-files-cloud-adapter';

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

  async sendMassPushByFilter(filterType: 'USER_NORMAL' | 'MOTORIZADO' | 'ADMIN' | 'USER_CON_NEGOCIO' | 'TODOS', title: string, body: string, data: any = {}) {
    if (!NotificationService.instance) {
      console.warn('⚠️ Intentando enviar mass push pero FCM no está inicializado.');
      return;
    }

    try {
      let query = PushToken.createQueryBuilder("push_token");

      switch (filterType) {
        case 'TODOS':
          // Todos los tokens (sin discriminación, pero preferiblemente activos)
          query = query
            .leftJoin("push_token.user", "user")
            .where("(user.id IS NULL OR user.status = :status)", { status: Status.ACTIVE });
          break;
        case 'USER_NORMAL':
          // Usuarios normales activos
          query = query
            .innerJoin("push_token.user", "user")
            .where("user.status = :status", { status: Status.ACTIVE });
          break;
        case 'MOTORIZADO':
          query = query.where("push_token.motorizadoId IS NOT NULL");
          break;
        case 'ADMIN':
          query = query.where("push_token.adminId IS NOT NULL");
          break;
        case 'USER_CON_NEGOCIO':
          // Usuarios activos que tienen al menos un negocio
          query = query
            .innerJoin("push_token.user", "user")
            .innerJoin("user.negocios", "negocio")
            .where("user.status = :status", { status: Status.ACTIVE });
          break;
        default:
          console.error("Filtro no reconocido:", filterType);
          return;
      }

      const tokens = await query.getMany();

      if (tokens.length === 0) {
        console.log(`ℹ️ No hay tokens registrados para el filtro ${filterType}.`);
        return;
      }

      // Remover duplicados
      const uniqueTokens = [...new Set(tokens.map(t => t.token))];

      console.log(`📡 Preparando envío masivo a ${uniqueTokens.length} dispositivos (${filterType})...`);

      // Crear registro de Campaña Push
      const campaign = new Campaign();
      campaign.type = CampaignType.PUSH;
      campaign.name = `Push: ${title.substring(0, 30)}`;
      campaign.subject = title;
      campaign.content = body;
      campaign.filters = { role: filterType };
      campaign.status = CampaignStatus.PROCESSING;
      campaign.totalTargets = uniqueTokens.length;
      campaign.mediaUrl = data.image || null;
      await campaign.save();

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
            notification: { sound: 'default', imageUrl: data.image }
          },
          apns: {
            payload: { aps: { contentAvailable: true, sound: 'default', mutableContent: true } },
            fcmOptions: { imageUrl: data.image }
          },
          webpush: {
            headers: { Urgency: 'high' },
            notification: {
              icon: data.icon || `${envs.WEBSERVICE_URL_FRONT}/logo_resized_192x192.png`,
              badge: `${envs.WEBSERVICE_URL_FRONT}/badge_96x96.png`,
              image: data.image
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

      console.log(`✅ Mass Push (${filterType}) finalizado: ${totalSuccess} exitosos, ${totalFailed} fallidos.`);

      // Actualizar registro de Campaña Push
      campaign.sentCount = totalSuccess;
      campaign.failedCount = totalFailed;
      campaign.status = CampaignStatus.COMPLETED;
      await campaign.save();

      // Auto-Destrucción de Imagen S3 en 24 horas
      if (data.imageKey) {
        console.log(`🕒 Programando auto-destrucción en S3 para la imagen de la campaña Push (Key: ${data.imageKey}) en 24 horas.`);
        setTimeout(async () => {
          try {
            await UploadFilesCloud.deleteFile({ bucketName: envs.AWS_BUCKET_NAME, key: data.imageKey });
            console.log(`💥 Imagen de campaña Push eliminada de S3: ${data.imageKey}`);
          } catch (e) {
            console.error(`❌ Error al auto-destruir imagen de campaña Push en S3:`, e);
          }
        }, 24 * 60 * 60 * 1000); // 24 horas
      }

      // 3. Limpiar base de datos de tokens inválidos globales
      if (failedTokens.length > 0) {
        console.log(`🧹 Limpiando ${failedTokens.length} tokens inválidos...`);
        for(let j = 0; j < failedTokens.length; j += 500) {
          const deleteChunk = failedTokens.slice(j, j + 500);
          await PushToken.createQueryBuilder()
            .delete()
            .where("token IN (:...tokens)", { tokens: deleteChunk })
            .execute();
        }
      }

    } catch (error) {
      console.error(`❌ Error crítico en sendMassPushByFilter (${filterType}):`, error);
    }
  }
}
