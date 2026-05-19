const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { ApolloServer } = require('@apollo/server');
const { expressMiddleware } = require('@as-integrations/express4');
const fs = require('fs');
const path = require('path');
const { userClient, reservationClient, notificationClient, callGrpc } = require('./grpcClients');
const resolvers = require('./resolvers');

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(cors());
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Trop de requêtes, réessayez dans 15 minutes.',
}));

app.get('/', (req, res) => {
  res.json({
    message: 'API Gateway - Plateforme de Réservation Intelligente',
    rest: {
      users: '/users',
      reservations: '/reservations',
      notifications: '/notifications',
    },
    graphql: '/graphql',
  });
});

// USERS
app.get('/users', async (req, res) => {
  try {
    const response = await callGrpc(userClient, 'searchUsers', { query: req.query.query || '' });
    res.json({ message: 'success', data: response.users });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/users/:id', async (req, res) => {
  try {
    const response = await callGrpc(userClient, 'getUser', { user_id: req.params.id });
    res.json({ message: 'success', data: response.user });
  } catch (err) { res.status(404).json({ error: 'Utilisateur non trouvé' }); }
});

app.post('/users', async (req, res) => {
  try {
    const { nom, email, telephone, password } = req.body;
    const response = await callGrpc(userClient, 'createUser', {
      nom, email, telephone: telephone || '', password,
    });
    res.status(201).json({ message: 'success', data: response.user });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

app.put('/users/:id', async (req, res) => {
  try {
    const { nom, email, telephone } = req.body;
    const response = await callGrpc(userClient, 'updateUser', {
      user_id: req.params.id, nom, email, telephone: telephone || '',
    });
    res.json({ message: 'success', data: response.user });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

app.delete('/users/:id', async (req, res) => {
  try {
    const response = await callGrpc(userClient, 'deleteUser', { user_id: req.params.id });
    res.json({ message: 'success', deleted: response.success });
  } catch (err) { res.status(404).json({ error: 'Utilisateur non trouvé' }); }
});

// RESERVATIONS
app.get('/reservations', async (req, res) => {
  try {
    const response = await callGrpc(reservationClient, 'searchReservations', {
      user_id: req.query.user_id || '',
      statut: req.query.statut || '',
    });
    res.json({ message: 'success', data: response.reservations });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/reservations/:id', async (req, res) => {
  try {
    const response = await callGrpc(reservationClient, 'getReservation', { reservation_id: req.params.id });
    res.json({ message: 'success', data: response.reservation });
  } catch (err) { res.status(404).json({ error: 'Réservation non trouvée' }); }
});

app.post('/reservations', async (req, res) => {
  try {
    const { user_id, ressource, date_debut, date_fin, notes } = req.body;
    const response = await callGrpc(reservationClient, 'createReservation', {
      user_id, ressource, date_debut, date_fin, notes: notes || '',
    });
    res.status(201).json({ message: 'success', data: response.reservation });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

app.put('/reservations/:id', async (req, res) => {
  try {
    const { statut, notes } = req.body;
    const response = await callGrpc(reservationClient, 'updateReservation', {
      reservation_id: req.params.id, statut: statut || '', notes: notes || '',
    });
    res.json({ message: 'success', data: response.reservation });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

app.delete('/reservations/:id', async (req, res) => {
  try {
    const response = await callGrpc(reservationClient, 'deleteReservation', { reservation_id: req.params.id });
    res.json({ message: 'success', deleted: response.success });
  } catch (err) { res.status(404).json({ error: 'Réservation non trouvée' }); }
});

// NOTIFICATIONS
app.get('/notifications', async (req, res) => {
  try {
    if (!req.query.user_id) return res.status(400).json({ error: 'user_id requis' });
    const response = await callGrpc(notificationClient, 'getNotifications', { user_id: req.query.user_id });
    res.json({ message: 'success', data: response.notifications });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/notifications', async (req, res) => {
  try {
    const { user_id, type, message } = req.body;
    const response = await callGrpc(notificationClient, 'sendNotification', { user_id, type, message });
    res.status(201).json({ message: 'success', data: response.notification });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

app.put('/notifications/:id/read', async (req, res) => {
  try {
    const response = await callGrpc(notificationClient, 'markAsRead', { notification_id: req.params.id });
    res.json({ message: 'success', updated: response.success });
  } catch (err) { res.status(404).json({ error: 'Notification non trouvée' }); }
});

// GRAPHQL
const typeDefs = fs.readFileSync(path.join(__dirname, 'schema.gql'), 'utf8');

async function startServer() {
  const apolloServer = new ApolloServer({ typeDefs, resolvers });
  await apolloServer.start();
  app.use('/graphql', cors(), express.json(), expressMiddleware(apolloServer));
  app.listen(PORT, () => {
    console.log('API Gateway démarré sur le port', PORT);
    console.log('REST    : http://localhost:' + PORT + '/');
    console.log('GraphQL : http://localhost:' + PORT + '/graphql');
  });
}

startServer().catch(console.error);