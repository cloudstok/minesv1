import { createPool } from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();
import {createLogger} from './logger.js';
const logger = createLogger('Database');
import { appConfig } from './app-config.js';
const { host, port, database, password, user, retries, interval } = appConfig.dbConfig;
const dbConfig = {
    host,
    user,
    password,
    database,
    port
};

const maxRetries = +retries;
const retryInterval = +interval;

let pool;

const createDatabasePool = async (config) => {
    let attempts = 0;
    while (attempts < maxRetries) {
        try {
            pool = createPool(config);
            logger.info("DATABASE POOLS CREATED AND EXPORTED");
            return;
        } catch (err) {
            attempts += 1;
            logger.error(`DATABASE CONNECTION FAILED. Retry ${attempts}/${maxRetries}. Error: ${err.message}`);
            if (attempts >= maxRetries) {
                logger.error("Maximum retries reached. Could not connect to the database.");
                process.exit(1);
            }
            await new Promise(res => setTimeout(res, retryInterval));
        }
    }
};

export const read = async (query, params = []) => {
    if (!pool) throw new Error('Database pool is not initialized');
    const connection = await pool.getConnection();
    try {
        const [results] = await connection.execute(query, params);
        return results;
    } finally {
        connection.release(); // Release the connection back to the pool
    }
};

export const write = async (query, params = []) => {
    if (!pool) throw new Error('Database pool is not initialized');
    const connection = await pool.getConnection();
    try {
        const [results] = await connection.execute(query, params);
        return results;
    } finally {
        connection.release(); // Release the connection back to the pool
    }
};

export const checkDatabaseConnection = async () => {
    if (!pool) {
        await createDatabasePool(dbConfig);
    }
    logger.info("DATABASE CONNECTION CHECK PASSED");
};

