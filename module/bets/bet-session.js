import { playerGames } from "../../services/game-event.js";
import { appConfig } from "../../utilities/app-config.js";
import { updateBalanceFromAccount } from "../../utilities/common-function.js";
import { countMinesAndRevealed, generateGrid, getNextMultiplier } from "../../utilities/helper-function.js";
import { setCache } from "../../utilities/redis-connection.js";
import { insertSettlement } from "./bet-db.js";

export const createGameData = async (matchId, betAmount, mineCount, playerDetails, socket) => {
    const userIP = socket.handshake.headers?.['x-forwarded-for']?.split(',')[0].trim() || socket.handshake.address;
    const playerId = playerDetails.id.split(':')[1];

    const updateBalanceData = {
        id: matchId,
        bet_amount: betAmount,
        socket_id: playerDetails.socketId,
        user_id: playerId,
        ip: userIP
    };

    const transaction = await updateBalanceFromAccount(updateBalanceData, "DEBIT", playerDetails);
    if (!transaction) return { error: 'Bet Cancelled by Upstream' };

    playerDetails.balance = (playerDetails.balance - betAmount).toFixed(2);
    await setCache(`PL:${playerDetails.socketId}`, JSON.stringify(playerDetails));
    socket.emit('info', { user_id: playerDetails.userId, operator_id: playerDetails.operatorId, balance: playerDetails.balance });

    const gameData = {
        matchId: matchId,
        bet_id: `BT:${matchId}:${playerDetails.operatorId}:${playerDetails.userId}:${betAmount}:${mineCount}`,
        bank: betAmount,
        bet: betAmount,
        multiplier: getNextMultiplier((mineCount)),
        playerGrid: generateGrid(mineCount),
        revealedCells: [],
        revealedCellCount: mineCount,
        txn_id: transaction.txn_id
    }
    return gameData;
}

export const revealedCells = async (game, playerDetails, row, col, socket) => {
    const playerGrid = game.playerGrid;
    if (!(playerGrid && playerGrid[row][col])) return { error: 'Invalid Row or Column Passed' };
    if (playerGrid[row][col].revealed) return { error: 'Block is already revealed' };
    game.playerGrid[row][col].revealed = true;
    game.revealedCells.push(`${row}:${col}`);
    game.revealedCellCount++;
    if (playerGrid[row][col].isMine) {
        await insertSettlement({
            roundId: game.matchId,
            bet_id: game.bet_id,
            gameData: JSON.stringify(game),
            userId: playerDetails.userId,
            operatorId: playerDetails.operatorId,
            bet_amount: game.bet,
            max_mult: 0.00,
            status: 'LOSS'
        });
        game.matchId = '', game.bank = 0.00, game.multiplier = 0; game.bombPos = `${row}:${col}`
        playerGames.delete(`GM:${playerDetails.id}`);
        return { eventName: 'match_ended', game };
    };
    const revealedCountAndMines = countMinesAndRevealed(game.playerGrid);
    if (revealedCountAndMines == (game.playerGrid.length * game.playerGrid[0].length)) {
        game.multiplier = getNextMultiplier(revealedCountAndMines);
        game.currentMultiplier = game.multiplier;
        game.bank = (Number(game.bet) * Number(game.multiplier)).toFixed(2);
        const cashoutData = await cashOutAmount(game, playerDetails, socket);
        return { eventName: 'cash_out_complete', cashoutData };
    };
    game.bank = (Number(game.bet) * Number(game.multiplier)).toFixed(2);
    game.currentMultiplier = game.multiplier;
    game.multiplier = getNextMultiplier(game.revealedCellCount);
    playerGames.set(`GM:${playerDetails.id}`, game);
    return {
        matchId: game.matchId,
        bank: game.bank,
        revealedCells: game.revealedCells,
        multiplier: game.multiplier
    }
}


export const cashOutAmount = async (game, playerDetails, socket) => {
    const winAmount = Math.min(game.bank, appConfig.maxCashoutAmount).toFixed(2);
    const userIP = socket.handshake.headers?.['x-forwarded-for']?.split(',')[0].trim() || socket.handshake.address;
    const updateBalanceData = {
        id: game.matchId,
        winning_amount: winAmount,
        socket_id: playerDetails.socketId,
        txn_id: game.txn_id,
        user_id: playerDetails.id.split(':')[1],
        ip: userIP
    };
    const isTransactionSuccessful = await updateBalanceFromAccount(updateBalanceData, "CREDIT", playerDetails);
    if (!isTransactionSuccessful) console.error(`Credit failed for user: ${playerDetails.userId} for round ${game.roundId}`);
    playerDetails.balance = (Number(playerDetails.balance) + Number(winAmount)).toFixed(2);
    await setCache(`PL:${playerDetails.socketId}`, JSON.stringify(playerDetails));
    socket.emit('info', { user_id: playerDetails.userId, operator_id: playerDetails.operatorId, balance: playerDetails.balance });
    await insertSettlement({
        roundId: game.matchId,
        bet_id: game.bet_id,
        gameData: JSON.stringify(game),
        userId: playerDetails.userId,
        operatorId: playerDetails.operatorId,
        bet_amount: game.bet,
        max_mult: game.currentMultiplier || 1.00,
        status: 'WIN'
    });
    playerGames.delete(`GM:${playerDetails.id}`);
    return {
        payout: winAmount,
        matchId: '',
        playerGrid: game.playerGrid,
        multiplier: game.multiplier
    };
}

