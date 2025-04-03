import { write } from "../../utilities/db-connection.js";


export const insertSettlement = async(data)=> {
    try{
        const { roundId, bet_id, gameData, userId, operatorId, bet_amount, max_mult, status} = data;
        const decodeUserId = decodeURIComponent(userId);
        await write(`INSERT INTO settlement (bet_id, lobby_id, game_data, user_id, operator_id, bet_amount, max_mult, status) VALUES(?, ?, ?, ?, ?, ?, ?, ?)`, [bet_id, roundId, JSON.stringify(gameData), decodeUserId, operatorId, bet_amount, max_mult, status]);
        console.log(`Settlement data inserted successfully`);
    }catch(err){
        console.error(`Err while inserting data in table is:::`, err);
    }
}