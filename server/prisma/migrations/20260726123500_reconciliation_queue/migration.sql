CREATE TABLE `reconciliation_item_records` (
  `_id` VARCHAR(191) NOT NULL,
  `organizationId` VARCHAR(191) NOT NULL,
  `channel` VARCHAR(191) NOT NULL,
  `identifier` VARCHAR(191) NOT NULL,
  `candidateLeadIds` JSON NOT NULL,
  `payload` JSON NOT NULL,
  `status` VARCHAR(191) NOT NULL DEFAULT 'pending',
  `resolvedLeadId` VARCHAR(191) NULL,
  `resolvedBy` VARCHAR(191) NULL,
  `resolvedAt` DATETIME(3) NULL,
  `createdDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedDate` DATETIME(3) NOT NULL,
  INDEX `reconciliation_item_records_organizationId_status_createdD_idx` (`organizationId`, `status`, `createdDate`),
  PRIMARY KEY (`_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
