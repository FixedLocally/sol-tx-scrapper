-- phpMyAdmin SQL Dump
-- version 5.2.0
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: May 07, 2023 at 08:51 PM
-- Server version: 10.8.3-MariaDB
-- PHP Version: 8.0.20

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `solana_data`
--

-- --------------------------------------------------------

--
-- Table structure for table `cg_mapping`
--

CREATE TABLE `cg_mapping` (
  `token_address` varchar(48) NOT NULL,
  `cg_symbol` varchar(32) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- --------------------------------------------------------

--
-- Table structure for table `price_history`
--

CREATE TABLE `price_history` (
  `token_address` varchar(48) NOT NULL,
  `date` char(10) NOT NULL,
  `price` double DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- --------------------------------------------------------

--
-- Table structure for table `txs`
--

CREATE TABLE `txs` (
  `id` int(11) NOT NULL,
  `entity` varchar(48) NOT NULL,
  `sig` varchar(96) NOT NULL,
  `dataset` varchar(16) NOT NULL,
  `classification` tinyint(4) NOT NULL COMMENT 'normal=0; scam/hack=1'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- --------------------------------------------------------

--
-- Table structure for table `tx_details`
--

CREATE TABLE `tx_details` (
  `id` int(11) NOT NULL,
  `details` longtext NOT NULL,
  `source` varchar(48) NOT NULL,
  `destination` varchar(48) NOT NULL,
  `block_time` int(11) NOT NULL,
  `target_passive_tx_30d` int(11) NOT NULL DEFAULT -1,
  `target_active_tx_30d` int(11) NOT NULL DEFAULT -1,
  `target_outgoing_tx_proportion` int(11) NOT NULL DEFAULT -1,
  `new_target` tinyint(4) NOT NULL DEFAULT -1 COMMENT 'tx target''s first tx is within 24h',
  `is_single_effective_ix` tinyint(11) NOT NULL DEFAULT -1 COMMENT 'ix count excluding compute budget',
  `is_simple_transfer` tinyint(11) NOT NULL DEFAULT -1 COMMENT 'all effective ixs are sol/spl transfers',
  `tx_value` double NOT NULL DEFAULT -1 COMMENT '$ value of tx at tx time',
  `is_program_invocation` tinyint(11) NOT NULL DEFAULT -1,
  `has_memo` tinyint(11) NOT NULL DEFAULT -1,
  `prio_fee_lamports` int(11) NOT NULL DEFAULT -1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- --------------------------------------------------------

--
-- Table structure for table `tx_history`
--

CREATE TABLE `tx_history` (
  `address` varchar(48) NOT NULL,
  `block_time` int(11) NOT NULL,
  `sig` varchar(96) NOT NULL,
  `active` tinyint(4) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- --------------------------------------------------------

--
-- Stand-in structure for view `uniq_addresses`
-- (See below for the actual view)
--
CREATE TABLE `uniq_addresses` (
`addr` varchar(48)
);

-- --------------------------------------------------------

--
-- Structure for view `uniq_addresses`
--
DROP TABLE IF EXISTS `uniq_addresses`;

CREATE ALGORITHM=UNDEFINED DEFINER=`admin`@`localhost` SQL SECURITY DEFINER VIEW `uniq_addresses`  AS SELECT `tx_details`.`source` AS `addr` FROM `tx_details` union select `tx_details`.`destination` AS `addr` from `tx_details`  ;

--
-- Indexes for dumped tables
--

--
-- Indexes for table `cg_mapping`
--
ALTER TABLE `cg_mapping`
  ADD PRIMARY KEY (`token_address`);

--
-- Indexes for table `price_history`
--
ALTER TABLE `price_history`
  ADD PRIMARY KEY (`token_address`,`date`);

--
-- Indexes for table `txs`
--
ALTER TABLE `txs`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `sig_2` (`sig`);

--
-- Indexes for table `tx_details`
--
ALTER TABLE `tx_details`
  ADD PRIMARY KEY (`id`),
  ADD KEY `source` (`source`),
  ADD KEY `destination` (`destination`),
  ADD KEY `block_time` (`block_time`);

--
-- Indexes for table `tx_history`
--
ALTER TABLE `tx_history`
  ADD UNIQUE KEY `sig` (`sig`),
  ADD KEY `address` (`address`,`block_time`) USING BTREE;

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `txs`
--
ALTER TABLE `txs`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `tx_details`
--
ALTER TABLE `tx_details`
  ADD CONSTRAINT `tx_details_ibfk_1` FOREIGN KEY (`id`) REFERENCES `txs` (`id`);
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
