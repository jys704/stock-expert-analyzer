CREATE TABLE `analysisReports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`firebaseUserId` varchar(128) NOT NULL,
	`userEmail` varchar(320),
	`symbol` varchar(32) NOT NULL,
	`stockName` varchar(160) NOT NULL,
	`score` int NOT NULL,
	`grade` varchar(8) NOT NULL,
	`stance` varchar(64) NOT NULL,
	`report` text NOT NULL,
	`snapshotJson` text NOT NULL,
	`fileKey` varchar(512) NOT NULL,
	`fileUrl` varchar(1024) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `analysisReports_id` PRIMARY KEY(`id`)
);
