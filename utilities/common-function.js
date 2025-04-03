import axios  from 'axios';
import crypto from 'crypto';
import { sendToQueue } from './amqp.js';
import { createLogger } from './logger.js';
const thirdPartyLogger = createLogger('ThirdPartyRequest', 'jsonl');
const failedThirdPartyLogger = createLogger('FailedThirdPartyRequest', 'jsonl');

export const generateUUIDv7 = () => {
    const timestamp = Date.now();
    const timeHex = timestamp.toString(16).padStart(12, '0');
    const randomBits = crypto.randomBytes(8).toString('hex').slice(2);
    const uuid = [
        timeHex.slice(0, 8),  
        timeHex.slice(8) + randomBits.slice(0, 4),  
        '7' + randomBits.slice(4, 7),  
        (parseInt(randomBits.slice(7, 8), 16) & 0x3f | 0x80).toString(16) + randomBits.slice(8, 12),  
        randomBits.slice(12) 
    ];

    return uuid.join('-');
}



export const updateBalanceFromAccount = async(data, key, playerDetails) => {
    try {
        const webhookData = await prepareDataForWebhook({ ...data, game_id: playerDetails.game_id }, key);
        if(key === 'CREDIT'){
            thirdPartyLogger.info(JSON.stringify({ logId: generateUUIDv7(), webhookData, playerDetails }));
            await sendToQueue('', 'games_cashout', JSON.stringify({ ...webhookData, operatorId: playerDetails.operatorId, token: playerDetails.token}));
            return true;
        }
        data.txn_id = webhookData.txn_id;
        const sendRequest = await sendRequestToAccounts(webhookData, playerDetails.token);
        if (!sendRequest) return false;        
        return data;
    } catch (err) {
        console.error(`Err while updating Player's balance is`, err);
        return false;
    }
}

export const sendRequestToAccounts = async(webhookData, token)=> {
    try {
        const url = process.env.service_base_url;
        let clientServerOptions = {
            method: 'POST',
            url: `${url}/service/operator/user/balance/v2`,
            headers: {
                token
            },
            data: webhookData,
            timeout: 1000 * 5
        };
        const data = (await axios(clientServerOptions))?.data;
        thirdPartyLogger.info(JSON.stringify({ logId: generateUUIDv7(), req: clientServerOptions, res: data}))
        if (!data.status) return false;
        return true;
    } catch (err) {
        console.error(`Err while sending request to accounts is:::`, err?.message);
        failedThirdPartyLogger.error(JSON.stringify({ logId: generateUUIDv7(), req: {webhookData, token}, res: err?.response?.status}));
        return false;
    }
}


export const prepareDataForWebhook = async(betObj, key) => {
    try {
        let {id, bet_amount, winning_amount, game_id, user_id, txn_id, ip} = betObj;
        bet_amount = Number(bet_amount).toFixed(2);
        let obj = {
            txn_id: generateUUIDv7(),
            ip,
            game_id,
            user_id: decodeURIComponent(user_id)
        };
        switch (key) {
            case "DEBIT":
                obj.amount = bet_amount,
                obj.description = `${bet_amount} debited for Mines game for bet_id ${id}`;
                obj.bet_id = id;
                obj.txn_type = 0;
                break;
            case "CREDIT":
                obj.amount = winning_amount;
                obj.txn_ref_id = txn_id;
                obj.description = `${winning_amount} credited for Mines game for bet_id ${id}`;
                obj.txn_type = 1;
                break;
            default:
                obj;
        }
        return obj;
    } catch (err) {
        console.error(`[ERR] while trying to prepare data for webhook is::`, err);
        return false;
    }
};

