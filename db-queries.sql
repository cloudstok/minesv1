CREATE DATABASE mines_game;
USE mines_game;

CREATE TABLE IF NOT EXISTS `settlement`(
  `settlement_id` int NOT NULL AUTO_INCREMENT,
  `bet_id` varchar(255) DEFAULT NULL,
  `lobby_id` varchar(255) DEFAULT NULL,
  `game_data` TEXT NOT NULL,
  `user_id` varchar(255) DEFAULT NULL,
  `operator_id` varchar(255) DEFAULT NULL,
  `bet_amount` decimal(10, 2) DEFAULT 0.00,
  `max_mult` decimal(10, 2) DEFAULT 0.00,
  `status` ENUM('WIN', 'LOSS') NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`settlement_id`)
);

 ALTER TABLE `mines_game`.`settlement` ADD INDEX `inx_bet_id` (`bet_id` ASC) VISIBLE, ADD INDEX `inx_lobby_id` (`lobby_id` ASC) VISIBLE, ADD INDEX `inx_user_id` (`user_id` ASC) INVISIBLE, ADD INDEX `inx_operator_id` (`operator_id` ASC) INVISIBLE, ADD INDEX `inx_bet_amount` (`bet_amount` ASC) INVISIBLE, ADD INDEX `inx_max_mult` (`max_mult` ASC) INVISIBLE, ADD INDEX `inx_status` (`status` ASC) VISIBLE;

  CREATE TABLE `config_master` (
   `id` int NOT NULL AUTO_INCREMENT,
   `data_key` varchar(60) NOT NULL,
   `value` json NOT NULL,
   `is_active` boolean default 1,
   `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
   `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
   PRIMARY KEY (`id`)
 ) ENGINE=InnoDB AUTO_INCREMENT=1627 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

 INSERT INTO config_master (`data_key`, `value`) VALUES('mine_data', '{"1":1.01,"2":1.05,"3":1.1,"4":1.15,"5":1.21,"6":1.27,"7":1.34,"8":1.42,"9":1.51,"10":1.61,"11":1.73,"12":1.86,"13":2.02,"14":2.2,"15":2.42,"16":2.69,"17":3.03,"18":3.46,"19":4.04,"20":4.85,"21":6.06,"22":8.08,"23":12.12,"24":24.25,"25":29.25}');
 INSERT INTO config_master (`data_key`, `value`) VALUES('board_size', '{"size": 5}');
