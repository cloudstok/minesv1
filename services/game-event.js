import { cashOutAmount, createGameData, revealedCells } from "../module/bets/bet-session.js";
import { appConfig } from "../utilities/app-config.js";
import { generateUUIDv7 } from "../utilities/common-function.js";
import { getCache, deleteCache, setCache } from "../utilities/redis-connection.js";
import { createLogger } from "../utilities/logger.js";
import { getRandomRowCol, logEventAndEmitResponse, MinesData } from "../utilities/helper-function.js";
const gameLogger = createLogger('Game', 'jsonl');
const betLogger = createLogger('Bets', 'jsonl');
const cashoutLogger = createLogger('Cashout', 'jsonl');
const timers = new Map();

const getPlayerDetailsAndGame = async (socket) => {
    const cachedPlayerDetails = await getCache(`PL:${socket.id}`);
    if (!cachedPlayerDetails) return { error: 'Invalid Player Details' };
    const playerDetails = JSON.parse(cachedPlayerDetails);

    const cachedGame = await getCache(`GM:${playerDetails.id}`);
    if (!cachedGame) return { error: 'Game Details not found' };
    const game = JSON.parse(cachedGame);

    return { playerDetails, game };
};

const generateTimerKeys = (playerId, matchId) => ({
    timerEventKey: `ET-${playerId}-${matchId}`,
});

const registerTimer = async (playerId, matchId, socket) => {
    const { timerEventKey } = generateTimerKeys(playerId, matchId);
    const timerEventId = setTimeout(() => socket.emit('auto_cashout', { timer: 10 }), 20 * 1000);
    timers.set(timerEventKey, timerEventId);
};

export const clearTimer = async (playerId, matchId) => {
    const { timerEventKey } = generateTimerKeys(playerId, matchId);

    if (timers.has(timerEventKey)) {
        clearTimeout(timers.get(timerEventKey));
        timers.delete(timerEventKey);
    }
};

const emitBetError = (socket, error) => socket.emit('betError', error);

export const emitMinesMultiplier = (socket) => {
    socket.emit('mines', JSON.stringify(MinesData()));
};

export const startGame = async (socket, betData) => {
    const [betAmount, mineCount] = betData.map(Number);
    if (!betAmount || !mineCount) return socket.emit('betError', 'Bet Amount and mine count is missing');
    if (mineCount < 1 || betAmount <= 0) return socket.emit('betError', 'Cheat Detected, Bet cannot be placed');
    const cachedPlayerDetails = await getCache(`PL:${socket.id}`);
    if (!cachedPlayerDetails) return socket.emit('betError', 'Invalid Player Details');
    const playerDetails = JSON.parse(cachedPlayerDetails);
    const gameLog = { logId: generateUUIDv7(), player: playerDetails, betAmount };
    if (Number(playerDetails.balance) < betAmount) return logEventAndEmitResponse(gameLog, 'Insufficient Balance', 'game', socket);
    if ((betAmount < appConfig.minBetAmount) || (betAmount > appConfig.maxBetAmount)) return logEventAndEmitResponse(gameLog, 'Invalid Bet', 'game', socket);
    const matchId = generateUUIDv7();
    const game = await createGameData(matchId, betAmount, mineCount, playerDetails, socket);
    await registerTimer(playerDetails.id, game.matchId, socket);
    gameLogger.info(JSON.stringify({ ...gameLog, game }));
    if (game.error) {
        await clearTimer(playerDetails.id, game.matchId);
        return emitBetError(socket, game.error)
    };
    await setCache(`GM:${playerDetails.id}`, JSON.stringify(game), 3600);
    return socket.emit("game_started", { matchId: game.matchId, bank: game.bank });
};

export const randomCell = async (socket) => {
    const { playerDetails, game, error } = await getPlayerDetailsAndGame(socket);
    if (error) return logEventAndEmitResponse({ socketId: socket.id }, error, 'bet', socket);
    await clearTimer(playerDetails.id, game.matchId);
    const randomRowColData = getRandomRowCol(game.playerGrid);
    const result = await revealedCells(game, playerDetails, randomRowColData.row, randomRowColData.col, socket);
    betLogger.info(JSON.stringify({ matchId: game.matchId, playerDetails, result }));
    if (result.error) return emitBetError(socket, result.error);
    if (result.eventName) return socket.emit(result.eventName, result.game || result.cashoutData);
    await registerTimer(playerDetails.id, game.matchId, socket);
    return socket.emit("revealed_cell", result);
};

export const revealCell = async (socket, cellData) => {
    const [row, col] = cellData.map(Number);
    const { playerDetails, game, error } = await getPlayerDetailsAndGame(socket);
    if (error) return logEventAndEmitResponse({ socketId: socket.id }, error, 'bet', socket);
    await clearTimer(playerDetails.id, game.matchId);
    const result = await revealedCells(game, playerDetails, row, col, socket);
    betLogger.info(JSON.stringify({ matchId: game.matchId, playerDetails, result }));
    if (result.error) return emitBetError(socket, result.error);
    if (result.eventName) return socket.emit(result.eventName, result.game || result.cashoutData);
    await registerTimer(playerDetails.id, game.matchId, socket);
    return socket.emit("revealed_cell", result);
};

export const cashOut = async (socket) => {
    const { playerDetails, game, error } = await getPlayerDetailsAndGame(socket);
    try {
        if (error) return logEventAndEmitResponse({ socketId: socket.id }, error, 'cashout', socket);
        await clearTimer(playerDetails.id, game.matchId);
        if (Number(game.bank) <= 0) return logEventAndEmitResponse({ socketId: socket.id, matchId: game.matchId, player: playerDetails }, 'Cashout amount cannot be less than or 0', 'cashout', socket);
        const winData = await cashOutAmount(game, playerDetails, socket);
        cashoutLogger.info(JSON.stringify({ socketId: socket.id, matchId: game.matchId, playerDetails, winData }));
        return socket.emit("cash_out_complete", winData);
    } catch (error) {
        console.error("Error during cash out:", error);
        cashoutLogger.error();
    };
};


export const disconnect = async (socket) => {
    const cachedPlayerDetails = await getCache(`PL:${socket.id}`);
    if (!cachedPlayerDetails) return socket.disconnect(true);
    const playerDetails = JSON.parse(cachedPlayerDetails);
    const cachedGame = await getCache(`GM:${playerDetails.id}`);
    if (cachedGame) await cashOut(socket);
    await deleteCache(`PL:${socket.id}`);
    console.log("User disconnected:", socket.id);
};
