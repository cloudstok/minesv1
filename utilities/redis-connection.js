import Redis from 'ioredis';
import dotenv from 'dotenv';
dotenv.config();
import { appConfig } from './app-config.js';
const { host, port, retry, interval } = appConfig.redis;
import {createLogger} from '../utilities/logger.js';
const logger = createLogger('Redis')

const redisConfig = {
    host: host || '127.0.0.1',
    port: port || 6379,
    password: process.env.REDIS_PASSWORD || undefined // Optional, if Redis is password-protected
};

const maxRetries = retry;
const retryInterval = interval; 

let redisClient;

const createRedisClient = () => {
    const client = new Redis(redisConfig);

    client.on('error', (err) => {
        logger.error(`REDIS ERROR: ${err.message}`);
    });

    client.on('connect', () => {
        logger.info('REDIS CONNECTION ESTABLISHED');
    });

    client.on('close', () => {
        logger.info('REDIS CONNECTION CLOSED');
    });

    return client;
};

export const initializeRedis = async () => {
    let retries = 0;

    while (retries < maxRetries) {
        try {
            redisClient = createRedisClient();
            await redisClient.set('test', 'test'); // Test connection
            await redisClient.del('test'); // Clean up
            logger.info("REDIS CONNECTION SUCCESSFUL");
            return redisClient;
        } catch (err) {
            retries += 1;
            logger.error(`REDIS CONNECTION FAILED. Retry ${retries}/${maxRetries}. Error: ${err.message}`);
            if (retries >= maxRetries) {
                logger.error("Maximum retries reached. Could not connect to Redis.");
                process.exit(1); // Exit the application with failure
            }
            await new Promise(res => setTimeout(res, retryInterval));
        }
    }
};

// Redis Operations
export const setCache = async (key, value, expiration = 3600 * 16) => {
    if (!redisClient) await initializeRedis();
    try {
        await redisClient.set(key, value, 'EX', expiration);
    } catch (error) {
        logger.error('Failed to set cache:', error.message);
    }
};

export const getCache = async (key) => {
    if (!redisClient) await initializeRedis();
    try {
        const value = await redisClient.get(key);
        if (value) {
            return value;
        } else {
            logger.info(`Cache not found: ${key}`);
            return null;
        }
    } catch (error) {
        logger.error('Failed to get cache:', error.message);
        return null;
    }
};

export const deleteCache = async (key) => {
    if (!redisClient) await initializeRedis();
    try {
        await redisClient.del(key);
    } catch (error) {
        logger.error('Failed to delete cache:', error.message);
    }
};

export const incrementCache = async (key, amount = 1) => {
    if (!redisClient) await initializeRedis();
    try {
        const newValue = await redisClient.incrby(key, amount);
        return newValue;
    } catch (error) {
        logger.error('Failed to increment cache:', error.message);
        return null;
    }
};

export const setHashField = async (hash, field, value) => {
    if (!redisClient) await initializeRedis();
    try {
        await redisClient.hset(hash, field, value);
    } catch (error) {
        logger.error('Failed to set hash field:', error.message);
    }
};

export const getHashField = async (hash, field) => {
    if (!redisClient) await initializeRedis();
    try {
        const value = await redisClient.hget(hash, field);
        if (value) {
            return value;
        } else {
            return null;
        }
    } catch (error) {
        logger.error('Failed to get hash field:', error.message);
        return null;
    }
};