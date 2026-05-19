const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const db = require('./database');
const { connectProducer, publishEvent } = require('./kafkaProducer');

const PROTO_PATH = path.join(__dirname, '../proto/user.proto');
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});
const userProto = grpc.loadPackageDefinition(packageDefinition).user;

function getUser(call, callback) {
  const { user_id } = call.request;
  db.get('SELECT * FROM users WHERE id = ?', [user_id], (err, row) => {
    if (err) {
      return callback({ code: grpc.status.INTERNAL, message: err.message });
    }
    if (!row) {
      return callback({ code: grpc.status.NOT_FOUND, message: 'Utilisateur non trouvé' });
    }
    callback(null, {
      user: {
        id: row.id,
        nom: row.nom,
        email: row.email,
        telephone: row.telephone || '',
      },
    });
  });
}

async function createUser(call, callback) {
  const { nom, email, telephone, password } = call.request;
  if (!nom || !email || !password) {
    return callback({
      code: grpc.status.INVALID_ARGUMENT,
      message: 'nom, email et password sont requis',
    });
  }
  const id = uuidv4();
  db.run(
    'INSERT INTO users (id, nom, email, telephone, password) VALUES (?, ?, ?, ?, ?)',
    [id, nom, email, telephone || '', password],
    async function (err) {
      if (err) {
        if (err.message.includes('UNIQUE')) {
          return callback({
            code: grpc.status.ALREADY_EXISTS,
            message: 'Email déjà utilisé',
          });
        }
        return callback({ code: grpc.status.INTERNAL, message: err.message });
      }
      await publishEvent('user-events', {
        type: 'USER_CREATED',
        user_id: id,
        nom,
        email,
        timestamp: new Date().toISOString(),
      });
      callback(null, {
        user: { id, nom, email, telephone: telephone || '' },
      });
    }
  );
}

function searchUsers(call, callback) {
  const { query } = call.request;
  const sql = query
    ? 'SELECT * FROM users WHERE nom LIKE ? OR email LIKE ?'
    : 'SELECT * FROM users';
  const params = query ? [`%${query}%`, `%${query}%`] : [];
  db.all(sql, params, (err, rows) => {
    if (err) {
      return callback({ code: grpc.status.INTERNAL, message: err.message });
    }
    callback(null, {
      users: rows.map((r) => ({
        id: r.id,
        nom: r.nom,
        email: r.email,
        telephone: r.telephone || '',
      })),
    });
  });
}

function deleteUser(call, callback) {
  const { user_id } = call.request;
  db.run('DELETE FROM users WHERE id = ?', [user_id], function (err) {
    if (err) {
      return callback({ code: grpc.status.INTERNAL, message: err.message });
    }
    if (this.changes === 0) {
      return callback({ code: grpc.status.NOT_FOUND, message: 'Utilisateur non trouvé' });
    }
    callback(null, { success: true });
  });
}

function updateUser(call, callback) {
  const { user_id, nom, email, telephone } = call.request;
  db.run(
    'UPDATE users SET nom = ?, email = ?, telephone = ? WHERE id = ?',
    [nom, email, telephone || '', user_id],
    function (err) {
      if (err) {
        return callback({ code: grpc.status.INTERNAL, message: err.message });
      }
      if (this.changes === 0) {
        return callback({ code: grpc.status.NOT_FOUND, message: 'Utilisateur non trouvé' });
      }
      callback(null, {
        user: { id: user_id, nom, email, telephone: telephone || '' },
      });
    }
  );
}

async function main() {
  await connectProducer();

  const server = new grpc.Server();
  server.addService(userProto.UserService.service, {
    getUser,
    createUser,
    searchUsers,
    deleteUser,
    updateUser,
  });

  server.bindAsync(
    '0.0.0.0:50051',
    grpc.ServerCredentials.createInsecure(),
    (err, port) => {
      if (err) {
        console.error('Erreur démarrage:', err);
        return;
      }
      console.log('Microservice Users démarré sur le port', port);
    }
  );
}

main().catch(console.error);