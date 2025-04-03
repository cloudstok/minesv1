import dotenv from "dotenv";
dotenv.config();
const {
  DB_HOST,
  DB_USER,
  DB_PASSWORD,
  DB_NAME,
  DB_PORT,
  DB_MAX_RETRIES,
  DB_RETRY_INTERVAL,
  MAX_BET_AMOUNT,
  MIN_BET_AMOUNT,
  MAX_CASHOUT,
  REDIS_HOST,
  REDIS_PORT,
  REDIS_RETRY,
  REDIS_RETRY_INTERVAL,
  MAX_BETS_LIMIT,
  BOARD_SIZE
} = process.env;

export const appConfig = {
  minBetAmount: +MIN_BET_AMOUNT,
  maxBetAmount: +MAX_BET_AMOUNT,
  maxCashoutAmount: +MAX_CASHOUT,
  maxBetLimit: +MAX_BETS_LIMIT,
  boardSize: Number(BOARD_SIZE),
  dbConfig: {
    host: DB_HOST,
    user: DB_USER,
    password: DB_PASSWORD,
    database: DB_NAME,
    port: DB_PORT,
    retries: DB_MAX_RETRIES,
    interval: DB_RETRY_INTERVAL,
  },
  redis: {
    host: REDIS_HOST,
    port: +REDIS_PORT,
    retry: +REDIS_RETRY,
    interval: +REDIS_RETRY_INTERVAL,
  },
};
