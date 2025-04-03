import { read } from "./db-connection.js";

export const variableConfig = {
    mineData : {},
    boardSize : 0
}

export const loadConfig = async () => {
    const configData = await read(`SELECT * FROM config_master where is_active = 1`);
    configData.forEach(data=> {
        if(data.data_key == 'mine_data'){
            variableConfig.mineData = data.value;
        }
        if(data.data_key == 'board_size'){
            variableConfig.boardSize = data?.value?.size
        }
    })
    console.log("DB Variables loaded in cache");
};

