const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const db = require('./database');
const { connectProducer, publishEvent } = require('./kafkaProducer');

const PROTO_PATH = path.join(__dirname, '../proto/reservation.proto');
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});
const reservationProto = grpc.loadPackageDefinition(packageDefinition).reservation;

function getReservation(call, callback) {
  const { reservation_id } = call.request;
  db.get('SELECT * FROM reservations WHERE id = ?', [reservation_id], (err, row) => {
    if (err) {
      return callback({ code: grpc.status.INTERNAL, message: err.message });
    }
    if (!row) {
      return callback({ code: grpc.status.NOT_FOUND, message: 'Réservation non trouvée' });
    }
    callback(null, { reservation: row });
  });
}

async function createReservation(call, callback) {
  const { user_id, ressource, date_debut, date_fin, notes } = call.request;
  if (!user_id || !ressource || !date_debut || !date_fin) {
    return callback({
      code: grpc.status.INVALID_ARGUMENT,
      message: 'user_id, ressource, date_debut et date_fin sont requis',
    });
  }
  const id = uuidv4();
  db.run(
    'INSERT INTO reservations (id, user_id, ressource, date_debut, date_fin, statut, notes) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [id, user_id, ressource, date_debut, date_fin, 'en_attente', notes || ''],
    async function (err) {
      if (err) {
        return callback({ code: grpc.status.INTERNAL, message: err.message });
      }
      const newRes = {
        id, user_id, ressource, date_debut, date_fin,
        statut: 'en_attente', notes: notes || '',
      };
      await publishEvent('reservation-events', {
        type: 'RESERVATION_CREATED',
        reservation_id: id,
        user_id,
        ressource,
        date_debut,
        date_fin,
        timestamp: new Date().toISOString(),
      });
      callback(null, { reservation: newRes });
    }
  );
}

function searchReservations(call, callback) {
  const { user_id, statut } = call.request;
  let sql = 'SELECT * FROM reservations WHERE 1=1';
  const params = [];
  if (user_id) { sql += ' AND user_id = ?'; params.push(user_id); }
  if (statut)  { sql += ' AND statut = ?';  params.push(statut); }
  db.all(sql, params, (err, rows) => {
    if (err) {
      return callback({ code: grpc.status.INTERNAL, message: err.message });
    }
    callback(null, { reservations: rows });
  });
}

async function updateReservation(call, callback) {
  const { reservation_id, statut, notes } = call.request;
  db.get('SELECT * FROM reservations WHERE id = ?', [reservation_id], async (err, row) => {
    if (err) {
      return callback({ code: grpc.status.INTERNAL, message: err.message });
    }
    if (!row) {
      return callback({ code: grpc.status.NOT_FOUND, message: 'Réservation non trouvée' });
    }
    const newStatut = statut || row.statut;
    const newNotes  = notes  || row.notes;
    db.run(
      'UPDATE reservations SET statut = ?, notes = ? WHERE id = ?',
      [newStatut, newNotes, reservation_id],
      async function (err2) {
        if (err2) {
          return callback({ code: grpc.status.INTERNAL, message: err2.message });
        }
        if (statut && statut !== row.statut) {
          await publishEvent('reservation-events', {
            type: 'RESERVATION_STATUS_CHANGED',
            reservation_id,
            user_id: row.user_id,
            old_statut: row.statut,
            new_statut: statut,
            timestamp: new Date().toISOString(),
          });
        }
        callback(null, {
          reservation: { ...row, statut: newStatut, notes: newNotes },
        });
      }
    );
  });
}

function deleteReservation(call, callback) {
  const { reservation_id } = call.request;
  db.run('DELETE FROM reservations WHERE id = ?', [reservation_id], function (err) {
    if (err) {
      return callback({ code: grpc.status.INTERNAL, message: err.message });
    }
    if (this.changes === 0) {
      return callback({ code: grpc.status.NOT_FOUND, message: 'Réservation non trouvée' });
    }
    callback(null, { success: true });
  });
}

async function main() {
  await connectProducer();

  const server = new grpc.Server();
  server.addService(reservationProto.ReservationService.service, {
    getReservation,
    createReservation,
    searchReservations,
    updateReservation,
    deleteReservation,
  });

  server.bindAsync(
    '0.0.0.0:50052',
    grpc.ServerCredentials.createInsecure(),
    (err, port) => {
      if (err) {
        console.error('Erreur démarrage:', err);
        return;
      }
      console.log('Microservice Réservations démarré sur le port', port);
    }
  );
}

main().catch(console.error);