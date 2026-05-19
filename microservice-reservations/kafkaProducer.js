const { Kafka } = require('kafkajs');

const kafka = new Kafka({
  clientId: 'microservice-reservations',
  brokers: [process.env.KAFKA_BROKER || 'localhost:9092'],
});

const producer = kafka.producer();

async function connectProducer() {
  try {
    await producer.connect();
    console.log('Reservations Kafka producer connecté.');
  } catch (err) {
    console.warn('Kafka non disponible (mode dégradé):', err.message);
  }
}

async function publishEvent(topic, event) {
  try {
    await producer.send({
      topic,
      messages: [
        {
          key: event.reservation_id || 'event',
          value: JSON.stringify(event),
        },
      ],
    });
    console.log('Événement publié sur', topic, ':', event.type);
  } catch (err) {
    console.warn('Erreur publication Kafka:', err.message);
  }
}

module.exports = { connectProducer, publishEvent };