import { startGame, disconnect, revealCell, cashOut, randomCell } from '../services/game-event.js';

export const registerEvents = async (socket) => {
    socket.on('message', (data) => {
        const event = data.split(':')
        switch (event[0]) {
            case 'SG': return startGame(socket, event.slice(1, event.length));
            case 'RC': return revealCell(socket, event.slice(1, event.length));
            case 'RDC': return randomCell(socket);
            case 'CO': return cashOut(socket);
        }
    })
    socket.on('disconnect', () => disconnect(socket));
}
