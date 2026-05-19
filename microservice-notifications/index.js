const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');
const { Kafka } = require('kafkajs');
const dbPromise = require('./database');

const PROTO_PATH = path.join(__dirname, '../proto/notification.proto');
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});
const notificationProto = grpc.loadPackageDefinition(packageDefinition).notification;

async function getNotifications(call, callback) {
  const { user_id } = call.request;
  const { notifications } = await dbPromise;
  const docs = await notifications.find({
    selector: user_id ? { user_id } : {},
  }).exec();
  callback(null, { notifications: docs.map((d) => d.toJSON()) });
}

async function sendNotification(call, callback) {
  const { user_id, type, message } = call.request;
  if (!user_id || !type || !message) {
    return callback({
      code: grpc.status.INVALID_ARGUMENT,
      message: 'Champs requis manquants',
    });
  }
  const { notifications, persistNotifications, createId } = await dbPromise;
  const notif = {
    id: createId(),
    user_id,
    type,
    message,
    statut: 'non_lu',
    created_at: new Date().toISOString(),
  };
  const inserted = await notifications.insert(notif);
  await persistNotifications(notifications);
  callback(null, { notification: inserted.toJSON() });
}

async function markAsRead(call, callback) {
  const { notification_id } = call.request;
  const { notifications, persistNotifications } = await dbPromise;
  const doc = await notifications.findOne(notification_id).exec();
  if (!doc) {
    return callback({ code: grpc.status.NOT_FOUND, message: 'Notification non trouvée' });
  }
  await doc.incrementalPatch({ statut: 'lu' });
  await persistNotifications(notifications);
  callback(null, { success: true });
}

async function handleKafkaEvent(event) {
  const { notifications, persistNotifications, createId } = await dbPromise;
  let notif = null;

  if (event.type === 'RESERVATION_CREATED') {
    notif = {
      id: createId(),
      user_id: event.user_id,
      type: 'RESERVATION_CONFIRMEE',
      message: `Votre réservation pour "${event.ressource}" du ${event.date_debut} au ${event.date_fin} a été enregistrée.`,
      statut: 'non_lu',
      created_at: new Date().toISOString(),
    };
  } else if (event.type === 'RESERVATION_STATUS_CHANGED') {
    notif = {
      id: createId(),
      user_id: event.user_id,
      type: 'STATUT_CHANGE',
      message: `Le statut de votre réservation est passé de "${event.old_statut}" à "${event.new_statut}".`,
      statut: 'non_lu',
      created_at: new Date().toISOString(),
    };
  } else if (event.type === 'USER_CREATED') {
    notif = {
      id: createId(),
      user_id: event.user_id,
      type: 'BIENVENUE',
      message: `Bienvenue ${event.nom} ! Votre compte a été créé avec succès.`,
      statut: 'non_lu',
      created_at: new Date().toISOString(),
    };
  }

  if (notif) {
    await notifications.insert(notif);
    await persistNotifications(notifications);
    console.log('Notification créée:', notif.type, 'pour user', notif.user_id);
  }
}

async function startKafkaConsumer() {
  const kafka = new Kafka({
    clientId: 'microservice-notifications-consumer',
    brokers: [process.env.KAFKA_BROKER || 'localhost:9092'],
  });
  const consumer = kafka.consumer({ groupId: 'notifications-group' });
  try {
    await consumer.connect();
    await consumer.subscribe({ topic: 'reservation-events', fromBeginning: false });
    await consumer.subscribe({ topic: 'user-events', fromBeginning: false });
    await consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        const value = message.value?.toString();
        console.log('Kafka reçu [' + topic + ']:', value);
        try {
          await handleKafkaEvent(JSON.parse(value));
        } catch (e) {
          console.error('Erreur traitement Kafka:', e.message);
        }
      },
    });
    console.log('Kafka consumer démarré.');
  } catch (err) {
    console.warn('Kafka non disponible (mode dégradé):', err.message);
  }
}

async function main() {
  await startKafkaConsumer();

  const server = new grpc.Server();
  server.addService(notificationProto.NotificationService.service, {
    getNotifications,
    sendNotification,
    markAsRead,
  });

  server.bindAsync(
    '0.0.0.0:50053',
    grpc.ServerCredentials.createInsecure(),
    (err, port) => {
      if (err) {
        console.error('Erreur démarrage:', err);
        return;
      }
      console.log('Microservice Notifications démarré sur le port', port);
    }
  );
}

main().catch(console.error);