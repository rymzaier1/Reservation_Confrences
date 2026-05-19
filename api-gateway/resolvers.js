const { userClient, reservationClient, notificationClient, callGrpc } = require('./grpcClients');

const resolvers = {
  Query: {
    user: async (_, { id }) => {
      const res = await callGrpc(userClient, 'getUser', { user_id: id });
      return res.user;
    },
    users: async (_, { query }) => {
      const res = await callGrpc(userClient, 'searchUsers', { query: query || '' });
      return res.users;
    },
    reservation: async (_, { id }) => {
      const res = await callGrpc(reservationClient, 'getReservation', { reservation_id: id });
      return res.reservation;
    },
    reservations: async (_, { user_id, statut }) => {
      const res = await callGrpc(reservationClient, 'searchReservations', {
        user_id: user_id || '',
        statut: statut || '',
      });
      return res.reservations;
    },
    notifications: async (_, { user_id }) => {
      const res = await callGrpc(notificationClient, 'getNotifications', { user_id });
      return res.notifications;
    },
  },
  Mutation: {
    createUser: async (_, { nom, email, telephone, password }) => {
      const res = await callGrpc(userClient, 'createUser', {
        nom, email, telephone: telephone || '', password,
      });
      return res.user;
    },
    updateUser: async (_, { id, nom, email, telephone }) => {
      const res = await callGrpc(userClient, 'updateUser', {
        user_id: id, nom, email, telephone: telephone || '',
      });
      return res.user;
    },
    deleteUser: async (_, { id }) => {
      const res = await callGrpc(userClient, 'deleteUser', { user_id: id });
      return res.success;
    },
    createReservation: async (_, { user_id, ressource, date_debut, date_fin, notes }) => {
      const res = await callGrpc(reservationClient, 'createReservation', {
        user_id, ressource, date_debut, date_fin, notes: notes || '',
      });
      return res.reservation;
    },
    updateReservation: async (_, { id, statut, notes }) => {
      const res = await callGrpc(reservationClient, 'updateReservation', {
        reservation_id: id, statut: statut || '', notes: notes || '',
      });
      return res.reservation;
    },
    deleteReservation: async (_, { id }) => {
      const res = await callGrpc(reservationClient, 'deleteReservation', { reservation_id: id });
      return res.success;
    },
    sendNotification: async (_, { user_id, type, message }) => {
      const res = await callGrpc(notificationClient, 'sendNotification', { user_id, type, message });
      return res.notification;
    },
    markNotificationAsRead: async (_, { id }) => {
      const res = await callGrpc(notificationClient, 'markAsRead', { notification_id: id });
      return res.success;
    },
  },
};

module.exports = resolvers;