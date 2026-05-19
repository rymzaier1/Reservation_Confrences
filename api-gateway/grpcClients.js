const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');

const PROTO_DIR = path.join(__dirname, '../proto');

const loadProto = (filename) =>
  protoLoader.loadSync(path.join(PROTO_DIR, filename), {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
  });

const userProto         = grpc.loadPackageDefinition(loadProto('user.proto')).user;
const reservationProto  = grpc.loadPackageDefinition(loadProto('reservation.proto')).reservation;
const notificationProto = grpc.loadPackageDefinition(loadProto('notification.proto')).notification;

const userClient = new userProto.UserService(
  '127.0.0.1:50051',
  grpc.credentials.createInsecure()
);
const reservationClient = new reservationProto.ReservationService(
  '127.0.0.1:50052',
  grpc.credentials.createInsecure()
);
const notificationClient = new notificationProto.NotificationService(
  '127.0.0.1:50053',
  grpc.credentials.createInsecure()
);

function callGrpc(client, method, request) {
  return new Promise((resolve, reject) => {
    client[method](request, (err, response) => {
      if (err) reject(err);
      else resolve(response);
    });
  });
}

module.exports = { userClient, reservationClient, notificationClient, callGrpc };