-- EMG System MySQL initialization
SET NAMES utf8mb4;
SET CHARACTER SET utf8mb4;

CREATE DATABASE IF NOT EXISTS `emg_system`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

GRANT ALL PRIVILEGES ON `emg_system`.* TO 'emg_user'@'%';
FLUSH PRIVILEGES;
