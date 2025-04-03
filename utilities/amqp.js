import client from "amqplib";
import {createLogger} from '../utilities/logger.js';
const rabbitMQLogger = createLogger('Queue');

let pubChannel, subChannel = null;
let connected = false;
const { AMQP_CONNECTION_STRING, AMQP_EXCHANGE_NAME } = process.env;
const exchange = AMQP_EXCHANGE_NAME;

export const initQueue = async() => {
    await connect();
}

export const connect = async() => {
    if (connected && pubChannel && subChannel) return;
    try {
        rabbitMQLogger.info("⌛️ Connecting to Rabbit-MQ Server", AMQP_CONNECTION_STRING.split('@')[1]);
        const connection = await client.connect(AMQP_CONNECTION_STRING);
        rabbitMQLogger.info("✅ Rabbit MQ Connection is ready");
        [pubChannel, subChannel] = await Promise.all([
            connection.createChannel(),
            connection.createChannel()
        ]);
        await pubChannel.assertExchange(exchange, "x-delayed-message", { autoDelete: false, durable: true,  
            arguments: { "x-delayed-type": "direct" } });    
        pubChannel.removeAllListeners('close');
        pubChannel.removeAllListeners('error');
        subChannel.removeAllListeners('close');
        subChannel.removeAllListeners('error');
        pubChannel.on('close', async () => { console.error("pubChannel Closed"); pubChannel = null; connected = false; });
        subChannel.on('close', async () => { console.error("subChannel Closed"); subChannel = null; connected = false; setTimeout(()=>initQueue(),1000)});
        pubChannel.on('error', async (msg) => { console.error("pubChannel Error", msg); });
        subChannel.on('error', async (msg) => { console.error("subChannel Error", msg); });
        rabbitMQLogger.info("🛸 Created RabbitMQ Channel successfully");
        connected = true;
    } catch (error) {
        rabbitMQLogger.error(error);
        rabbitMQLogger.error("Not connected to MQ Server");
    }
}

export const sendToQueue = async(ex, queueName, message, delay = 0, retries = 0) => {
    try {
        if (!pubChannel || pubChannel.connection._closing) {
            await connect();
        }
        await pubChannel.assertQueue(queueName, { durable: true });
        await pubChannel.bindQueue(queueName, exchange, queueName); // This is done for simplicity .
        pubChannel.publish(exchange, queueName, Buffer.from(message), {
            headers: { "x-delay": delay, "x-retries": retries }, persistent: true
        });
        console.log(`Message sent to ${queueName} queue on exchange ${exchange}`);
    } catch (error) {
        console.log(error);
        rabbitMQLogger.error(`Failed to send message to ${queueName} queue on exchange ${exchange}: ${error.message}`);
        throw error;
    }
}