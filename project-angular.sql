-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Hôte : 127.0.0.1:3306
-- Généré le : jeu. 26 juin 2025 à 23:08
-- Version du serveur : 9.1.0
-- Version de PHP : 8.3.14

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Base de données : `project-angular`
--

-- --------------------------------------------------------

--
-- Structure de la table `lateness`
--

DROP TABLE IF EXISTS `lateness`;
CREATE TABLE IF NOT EXISTS `lateness` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `date_lateness` datetime NOT NULL,
  `duration` int NOT NULL,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Déchargement des données de la table `lateness`
--

INSERT INTO `lateness` (`id`, `user_id`, `date_lateness`, `duration`) VALUES
(1, 3, '2025-09-09 00:00:00', 20),
(2, 4, '2025-09-14 00:00:00', 10),
(3, 3, '2025-09-20 10:05:00', 5),
(4, 3, '2025-12-12 00:00:00', 10),
(5, 2, '2025-10-12 00:00:00', 10);

-- --------------------------------------------------------

--
-- Structure de la table `role`
--

DROP TABLE IF EXISTS `role`;
CREATE TABLE IF NOT EXISTS `role` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(50) COLLATE utf8mb4_general_ci NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Déchargement des données de la table `role`
--

INSERT INTO `role` (`id`, `name`) VALUES
(1, 'admin'),
(3, 'stagiaire'),
(2, 'validateur');

-- --------------------------------------------------------

--
-- Structure de la table `training`
--

DROP TABLE IF EXISTS `training`;
CREATE TABLE IF NOT EXISTS `training` (
  `id` int NOT NULL AUTO_INCREMENT,
  `title` varchar(100) COLLATE utf8mb4_general_ci NOT NULL,
  `description` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `start_date` date DEFAULT NULL,
  `end_date` date DEFAULT NULL,
  `image` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `user_id` int NOT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_training_user` (`user_id`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Déchargement des données de la table `training`
--

INSERT INTO `training` (`id`, `title`, `description`, `start_date`, `end_date`, `image`, `user_id`) VALUES
(2, 'Développement Web avec ReactJS', 'Front-end moderne', '2024-04-29', '2024-11-29', '', 1),
(3, 'Bases de données relationnelles', 'Modélisation et SQL', '2025-09-17', '2025-09-17', '', 1),
(5, 'Concepteur Développeur Intégrateur IA', 'Le concepteur développeur d’applications conçoit et développe des applications sécurisées, tels que des logiciels d’entreprise, des applications pour mobiles et tablettes, ainsi que des sites Web.', '2025-02-10', '2025-09-10', '', 5),
(6, 'Python', 'Python est très demandé et accessible pour les débutants. Apprenez à coder avec Python pour écrire des programmes simples mais puissants, et pour automatiser les tâches.', '2025-10-10', '2026-10-10', '/upload/1750969505627-rick-and-morty-rick-5120x2880-9494.png', 5);

-- --------------------------------------------------------

--
-- Structure de la table `users`
--

DROP TABLE IF EXISTS `users`;
CREATE TABLE IF NOT EXISTS `users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `email` varchar(100) COLLATE utf8mb4_general_ci NOT NULL,
  `password` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `role_id` int NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`),
  KEY `role_id` (`role_id`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Déchargement des données de la table `users`
--

INSERT INTO `users` (`id`, `email`, `password`, `role_id`) VALUES
(1, 'direction@ecole.fr', '$2b$10$fzn4bExHg.Z7BTBbnOCwGOV/nJmWwC0NBGAYDuRcVRDpNcWVhp7uG', 1),
(2, 'alice.profs@ecole.fr', '$2b$10$fzn4bExHg.Z7BTBbnOCwGOV/nJmWwC0NBGAYDuRcVRDpNcWVhp7uG', 2),
(3, 'bob.etudiant@ecole.fr', '$2b$10$fzn4bExHg.Z7BTBbnOCwGOV/nJmWwC0NBGAYDuRcVRDpNcWVhp7uG', 3),
(4, 'clara.etudiant@ecole.fr', '$2b$10$fzn4bExHg.Z7BTBbnOCwGOV/nJmWwC0NBGAYDuRcVRDpNcWVhp7uG', 3),
(5, 'eval@e.com', '$2b$10$fzn4bExHg.Z7BTBbnOCwGOV/nJmWwC0NBGAYDuRcVRDpNcWVhp7uG', 1);

--
-- Contraintes pour les tables déchargées
--

--
-- Contraintes pour la table `lateness`
--
ALTER TABLE `lateness`
  ADD CONSTRAINT `lateness_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`);

--
-- Contraintes pour la table `training`
--
ALTER TABLE `training`
  ADD CONSTRAINT `fk_training_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`);

--
-- Contraintes pour la table `users`
--
ALTER TABLE `users`
  ADD CONSTRAINT `users_ibfk_1` FOREIGN KEY (`role_id`) REFERENCES `role` (`id`);
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
