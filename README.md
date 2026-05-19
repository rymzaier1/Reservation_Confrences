# Plateforme de Réservation Intelligente
## Mini-projet Microservices — SoA et Microservices 

---

## Membre:Rym zaier

---

## Description du projet

La Plateforme de Réservation Intelligente est une application
basée sur une architecture microservices qui permet à des
utilisateurs de créer un compte, effectuer des réservations
de ressources (salles, chambres, véhicules) et recevoir des
notifications automatiques à chaque événement important.

---

---

## Microservices

### Microservice 1 — Users (port 50051)
- Rôle : gestion des comptes utilisateurs
- Base de données : SQLite3 — users.sqlite
- Proto : proto/user.proto
- Méthodes gRPC : GetUser, CreateUser, SearchUsers, UpdateUser, DeleteUser
- Kafka : producteur — topic user-events

### Microservice 2 — Réservations (port 50052)
- Rôle : gestion des réservations
- Base de données : SQLite3 — reservations.sqlite
- Proto : proto/reservation.proto
- Méthodes gRPC : GetReservation, CreateReservation, SearchReservations, UpdateReservation, DeleteReservation
- Kafka : producteur — topic reservation-events

### Microservice 3 — Notifications (port 50053)
- Rôle : gestion des notifications automatiques
- Base de données : RxDB NoSQL — data/notifications.snapshot.json
- Proto : proto/notification.proto
- Méthodes gRPC : GetNotifications, SendNotification, MarkAsRead
- Kafka : consommateur — topics user-events et reservation-events

---

## API Gateway (port 3000)

Point d'entrée unique de l'application.
Expose REST et GraphQL.
Communique avec les microservices via gRPC.

---

## Endpoints REST

### Users
| Méthode | URL | Description | Body |
|---|---|---|---|
| GET | /users | Lister tous les utilisateurs | — |
| GET | /users/:id | Un utilisateur par ID | — |
| POST | /users | Créer un utilisateur | nom, email, telephone, password |
| PUT | /users/:id | Modifier un utilisateur | nom, email, telephone |
| DELETE | /users/:id | Supprimer un utilisateur | — |

### Réservations
| Méthode | URL | Description | Body |
|---|---|---|---|
| GET | /reservations | Lister toutes les réservations | — |
| GET | /reservations?user_id= | Filtrer par utilisateur | — |
| GET | /reservations?statut= | Filtrer par statut | — |
| GET | /reservations/:id | Une réservation par ID | — |
| POST | /reservations | Créer une réservation | user_id, ressource, date_debut, date_fin, notes |
| PUT | /reservations/:id | Modifier statut/notes | statut, notes |
| DELETE | /reservations/:id | Supprimer une réservation | — |

### Notifications
| Méthode | URL | Description |
|---|---|---|
| GET | /notifications?user_id= | Notifications d'un utilisateur |
| POST | /notifications | Envoyer une notification manuelle |
| PUT | /notifications/:id/read | Marquer comme lue |

---

## Schéma GraphQL

### Types
- User : id, nom, email, telephone
- Reservation : id, user_id, ressource, date_debut, date_fin, statut, notes
- Notification : id, user_id, type, message, statut, created_at

### Queries (lecture)
- user(id) — un utilisateur
- users(query) — liste des utilisateurs
- reservation(id) — une réservation
- reservations(user_id, statut) — liste des réservations
- notifications(user_id) — notifications d'un utilisateur

### Mutations (écriture)
- createUser, updateUser, deleteUser
- createReservation, updateReservation, deleteReservation
- sendNotification, markNotificationAsRead

---

## Topics Kafka

### Topic user-events
- Producteur : Microservice Users
- Consommateur : Microservice Notifications
- Événement : USER_CREATED
- Déclencheur : création d'un compte utilisateur
- Message :
```json
{
  "type": "USER_CREATED",
  "user_id": "uuid",
  "nom": "Ali",
  "email": "ali@test.com",
  "timestamp": "2025-09-01T10:00:00Z"
}
```
- Résultat : notification BIENVENUE créée automatiquement

### Topic reservation-events
- Producteur : Microservice Réservations
- Consommateur : Microservice Notifications

#### Événement 1 — RESERVATION_CREATED
- Déclencheur : création d'une réservation
- Message :
```json
{
  "type": "RESERVATION_CREATED",
  "reservation_id": "uuid",
  "user_id": "uuid",
  "ressource": "Salle A",
  "date_debut": "2025-09-01",
  "date_fin": "2025-09-02",
  "timestamp": "2025-09-01T10:00:00Z"
}
```
- Résultat : notification RESERVATION_CONFIRMEE créée automatiquement

#### Événement 2 — RESERVATION_STATUS_CHANGED
- Déclencheur : changement de statut d'une réservation
- Message :
```json
{
  "type": "RESERVATION_STATUS_CHANGED",
  "reservation_id": "uuid",
  "user_id": "uuid",
  "old_statut": "en_attente",
  "new_statut": "confirmee",
  "timestamp": "2025-09-01T10:05:00Z"
}
```
- Résultat : notification STATUT_CHANGE créée automatiquement

---

## Bases de données

| Microservice | Type | Technologie | Fichier |
|---|---|---|---|
| Users | SQL | SQLite3 | users.sqlite |
| Réservations | SQL | SQLite3 | reservations.sqlite |
| Notifications | NoSQL | RxDB | data/notifications.snapshot.json |

---

## Instructions d'installation

### Prérequis
- Node.js 18+
- Java 17+ (pour Kafka)
- Kafka 4.2 (kafka_2.13-4.2.0)

### Installer les dépendances
```bash
cd microservice-users && npm install
cd ../microservice-reservations && npm install
cd ../microservice-notifications && npm install
cd ../api-gateway && npm install
```

---

## Instructions d'exécution

### Étape 1 — Démarrer Kafka
```powershell
.\bin\windows\kafka-server-start.bat .\config\server.properties
```

### Étape 2 — Créer les topics
```powershell
.\bin\windows\kafka-topics.bat --create --topic user-events --partitions 3 --replication-factor 1 --bootstrap-server localhost:9092
.\bin\windows\kafka-topics.bat --create --topic reservation-events --partitions 3 --replication-factor 1 --bootstrap-server localhost:9092
```

### Étape 3 — Démarrer les microservices
```powershell
# Terminal 1
cd microservice-users && node index.js

# Terminal 2
cd microservice-reservations && node index.js

# Terminal 3
cd microservice-notifications && node index.js

# Terminal 4
cd api-gateway && node index.js
```

### Étape 4 — Tester
Ouvrez Postman et testez :
- REST : http://localhost:3000/users
- GraphQL : http://localhost:3000/graphql

---

## Scénario de test complet
POST /users              → créer Ali → noter id
POST /reservations       → créer réservation pour Ali
GET  /notifications      → voir 2 notifications Kafka automatiques
PUT  /reservations/:id   → changer statut à "confirmee"
GET  /notifications      → voir 3ème notification STATUT_CHANGE
GraphQL mutation         → créer Sarra via GraphQL
GraphQL query            → vérifier tous les utilisateurs
