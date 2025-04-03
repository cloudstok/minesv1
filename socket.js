import { getUserDataFromSource } from './module/players/player-data.js'
import { registerEvents } from './router/event-route.js';
import { emitMinesMultiplier } from "./services/game-event.js";
import { setCache } from "./utilities/redis-connection.js";

export const initSocket = (io)=> {
    const onConnection = async(socket)=>{
        console.log("socket connected");
        const token = socket.handshake.query.token;
        const game_id = socket.handshake.query.game_id;
        if(!token){
            socket.disconnect(true);            
            return console.log("No Token Provided",token);
        }
        const userData = await getUserDataFromSource(token, game_id);
        if(!userData) {
            console.log("Invalid token",token);
            return socket.disconnect(true); 
        };

        socket.emit('info', { user_id: userData.userId, operator_id: userData.operatorId, balance: Number(userData.balance).toFixed(2)});
        await setCache(`PL:${socket.id}`, JSON.stringify({...userData, socketId: socket.id}), 3600);
        emitMinesMultiplier(socket);
        registerEvents(socket);
        socket.on('error', (error) => {
            console.error(`Socket error: ${socket.id}. Error: ${error.message}`);
        });
    }   
    io.on("connection", onConnection);
}

