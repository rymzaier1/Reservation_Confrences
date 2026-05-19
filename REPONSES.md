# Documentation technique
## Plateforme de réservation intelligente

## Membre:Rym zaier
## Topics Kafka

### user-events
- Producteur : Microservice Users
- Consommateur : Microservice Notifications
- Événement : USER_CREATED
- Déclencheur : création d'un compte utilisateur
- Message :
{
  "type": "USER_CREATED",
  "user_id": "uuid",
  "nom": "Ali",
  "email": "ali@test.com",
  "timestamp": "2025-09-01T10:00:00Z"
}
- Résultat : notification BIENVENUE créée automatiquement

### reservation-events
- Producteur : Microservice Réservations
- Consommateur : Microservice Notifications
- Événement 1 : RESERVATION_CREATED
- Déclencheur : création d'une réservation
- Message :
{
  "type": "RESERVATION_CREATED",
  "reservation_id": "uuid",
  "user_id": "uuid",
  "ressource": "Salle A",
  "date_debut": "2025-09-01",
  "date_fin": "2025-09-02",
  "timestamp": "2025-09-01T10:00:00Z"
}
- Résultat : notification RESERVATION_CONFIRMEE créée automatiquement

- Événement 2 : RESERVATION_STATUS_CHANGED
- Déclencheur : changement de statut d'une réservation
- Message :
{
  "type": "RESERVATION_STATUS_CHANGED",
  "reservation_id": "uuid",
  "user_id": "uuid",
  "old_statut": "en_attente",
  "new_statut": "confirmee",
  "timestamp": "2025-09-01T10:05:00Z"
}
- Résultat : notification STATUT_CHANGE créée automatiquement

## Bases de données

| Microservice   | Type  | Technologie | Fichier                          |
|----------------|-------|-------------|----------------------------------|
| Users          | SQL   | SQLite3     | users.sqlite                     |
| Réservations   | SQL   | SQLite3     | reservations.sqlite              |
| Notifications  | NoSQL | RxDB        | data/notifications.snapshot.json |

## Endpoints REST

| Méthode | URL                      | Description              |
|---------|--------------------------|--------------------------|
| GET     | /users                   | Lister utilisateurs      |
| GET     | /users/:id               | Un utilisateur           |
| GET     | /users?query=            | Rechercher               |
| POST    | /users                   | Créer utilisateur        |
| PUT     | /users/:id               | Modifier utilisateur     |
| DELETE  | /users/:id               | Supprimer utilisateur    |
| GET     | /reservations            | Lister réservations      |
| GET     | /reservations/:id        | Une réservation          |
| GET     | /reservations?user_id=   | Filtrer par user         |
| GET     | /reservations?statut=    | Filtrer par statut       |
| POST    | /reservations            | Créer réservation        |
| PUT     | /reservations/:id        | Modifier réservation     |
| DELETE  | /reservations/:id        | Supprimer réservation    |
| GET     | /notifications?user_id=  | Notifications d'un user  |
| POST    | /notifications           | Envoyer notification     |
| PUT     | /notifications/:id/read  | Marquer comme lue        |

## Schéma GraphQL

### Types
- User : id, nom, email, telephone
- Reservation : id, user_id, ressource, date_debut, date_fin, statut, notes
- Notification : id, user_id, type, message, statut, created_at

### Queries
- users(query) → liste des utilisateurs
- user(id) → un utilisateur
- reservations(user_id, statut) → liste des réservations
- reservation(id) → une réservation
- notifications(user_id) → notifications d'un utilisateur

### Mutations
- createUser, updateUser, deleteUser
- createReservation, updateReservation, deleteReservation
- sendNotification, markNotificationAsRead

## Justification GraphQL
GraphQL est utilisé pour permettre au client de demander
précisément les champs dont il a besoin. Par exemple :
- Un client mobile peut demander uniquement id et nom
- Un dashboard peut demander tous les champs
- Une recherche peut combiner users et reservations en une seule requête

## Instructions d'installation

1. Installer Node.js 18+
2. Installer Java 17+ et Kafka 4.2

cd microservice-users && npm install
cd ../microservice-reservations && npm install
cd ../microservice-notifications && npm install
cd ../api-gateway && npm install

## Instructions d'exécution

### Démarrer Kafka
.\bin\windows\kafka-server-start.bat .\config\server.properties

### Créer les topics
.\bin\windows\kafka-topics.bat --create --topic user-events
  --partitions 3 --replication-factor 1
  --bootstrap-server localhost:9092

.\bin\windows\kafka-topics.bat --create --topic reservation-events
  --partitions 3 --replication-factor 1
  --bootstrap-server localhost:9092

### Démarrer les microservices
cd microservice-users && node index.js
cd microservice-reservations && node index.js
cd microservice-notifications && node index.js
cd api-gateway && node index.js
