-- Expand project marketing details without removing legacy property listings.
ALTER TABLE `real_estate_project_records`
  ADD COLUMN `description` TEXT NULL,
  ADD COLUMN `amenities` JSON NULL,
  ADD COLUMN `media` JSON NULL,
  ADD COLUMN `documents` JSON NULL;

CREATE INDEX `real_estate_project_records_organizationId_published_idx`
  ON `real_estate_project_records`(`organizationId`, `published`);

CREATE TABLE `inventory_structure_records` (
  `_id` VARCHAR(191) NOT NULL,
  `organizationId` VARCHAR(191) NOT NULL,
  `projectId` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `kind` VARCHAR(191) NOT NULL DEFAULT 'Tower',
  `totalLevels` INTEGER NULL,
  `unitNumberPattern` VARCHAR(191) NULL DEFAULT '{floor}{sequence:02}',
  `active` BOOLEAN NOT NULL DEFAULT true,
  `createdDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedDate` DATETIME(3) NOT NULL,
  UNIQUE INDEX `inventory_structure_records_projectId_name_key`(`projectId`, `name`),
  INDEX `inventory_structure_records_organizationId_kind_idx`(`organizationId`, `kind`),
  PRIMARY KEY (`_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `inventory_level_records` (
  `_id` VARCHAR(191) NOT NULL,
  `organizationId` VARCHAR(191) NOT NULL,
  `structureId` VARCHAR(191) NOT NULL,
  `levelNumber` INTEGER NOT NULL,
  `label` VARCHAR(191) NULL,
  `createdDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedDate` DATETIME(3) NOT NULL,
  UNIQUE INDEX `inventory_level_records_structureId_levelNumber_key`(`structureId`, `levelNumber`),
  INDEX `inventory_level_records_organizationId_idx`(`organizationId`),
  PRIMARY KEY (`_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `inventory_unit_records` (
  `_id` VARCHAR(191) NOT NULL,
  `organizationId` VARCHAR(191) NOT NULL,
  `structureId` VARCHAR(191) NOT NULL,
  `levelId` VARCHAR(191) NULL,
  `legacyPropertyId` VARCHAR(191) NULL,
  `unitNumber` VARCHAR(191) NOT NULL,
  `unitType` VARCHAR(191) NULL,
  `bedrooms` INTEGER NULL,
  `bathrooms` INTEGER NULL,
  `carpetArea` INTEGER NULL,
  `saleableArea` INTEGER NULL,
  `facing` VARCHAR(191) NULL,
  `listingPrice` DECIMAL(18,2) NULL,
  `baseCost` DECIMAL(18,2) NULL,
  `status` VARCHAR(191) NOT NULL DEFAULT 'Available',
  `statusChangedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `createdDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedDate` DATETIME(3) NOT NULL,
  UNIQUE INDEX `inventory_unit_records_structureId_unitNumber_key`(`structureId`, `unitNumber`),
  INDEX `inventory_unit_records_organizationId_status_idx`(`organizationId`, `status`),
  INDEX `inventory_unit_records_levelId_idx`(`levelId`),
  INDEX `inventory_unit_records_legacyPropertyId_idx`(`legacyPropertyId`),
  PRIMARY KEY (`_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `inventory_generation_batch_records` (
  `_id` VARCHAR(191) NOT NULL,
  `organizationId` VARCHAR(191) NOT NULL,
  `projectId` VARCHAR(191) NOT NULL,
  `structureId` VARCHAR(191) NOT NULL,
  `idempotencyKey` VARCHAR(191) NOT NULL,
  `request` JSON NOT NULL,
  `createdUnitCount` INTEGER NOT NULL,
  `createdBy` VARCHAR(191) NULL,
  `createdDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `inventory_batch_org_idempotency_key`(`organizationId`, `idempotencyKey`),
  INDEX `inventory_batch_structure_created_idx`(`structureId`, `createdDate`),
  PRIMARY KEY (`_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `sales_deal_records` (
  `_id` VARCHAR(191) NOT NULL,
  `organizationId` VARCHAR(191) NOT NULL,
  `projectId` VARCHAR(191) NOT NULL,
  `structureId` VARCHAR(191) NOT NULL,
  `unitId` VARCHAR(191) NOT NULL,
  `leadId` VARCHAR(191) NULL,
  `contactId` VARCHAR(191) NULL,
  `buyerProfileId` VARCHAR(191) NULL,
  `opportunityId` VARCHAR(191) NULL,
  `assignedAgentId` VARCHAR(191) NULL,
  `dealNumber` VARCHAR(191) NOT NULL,
  `agreementNumber` VARCHAR(191) NULL,
  `status` VARCHAR(191) NOT NULL DEFAULT 'Draft',
  `currency` VARCHAR(191) NOT NULL DEFAULT 'INR',
  `grossPrice` DECIMAL(18,2) NOT NULL,
  `discount` DECIMAL(18,2) NOT NULL DEFAULT 0,
  `netSaleValue` DECIMAL(18,2) NOT NULL,
  `taxes` DECIMAL(18,2) NOT NULL DEFAULT 0,
  `baseCost` DECIMAL(18,2) NOT NULL DEFAULT 0,
  `brokerage` DECIMAL(18,2) NOT NULL DEFAULT 0,
  `directExpenses` DECIMAL(18,2) NOT NULL DEFAULT 0,
  `agencyCommission` DECIMAL(18,2) NOT NULL DEFAULT 0,
  `paymentSchedule` JSON NULL,
  `documents` JSON NULL,
  `reservedAt` DATETIME(3) NULL,
  `agreementExecutedAt` DATETIME(3) NULL,
  `cancelledAt` DATETIME(3) NULL,
  `cancellationReason` TEXT NULL,
  `createdBy` VARCHAR(191) NULL,
  `createdDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedDate` DATETIME(3) NOT NULL,
  UNIQUE INDEX `sales_deal_records_organizationId_dealNumber_key`(`organizationId`, `dealNumber`),
  INDEX `sales_deal_org_status_executed_idx`(`organizationId`, `status`, `agreementExecutedAt`),
  INDEX `sales_deal_unit_status_idx`(`unitId`, `status`),
  INDEX `sales_deal_agent_executed_idx`(`assignedAgentId`, `agreementExecutedAt`),
  PRIMARY KEY (`_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `deal_payment_records` (
  `_id` VARCHAR(191) NOT NULL,
  `organizationId` VARCHAR(191) NOT NULL,
  `dealId` VARCHAR(191) NOT NULL,
  `reference` VARCHAR(191) NULL,
  `amount` DECIMAL(18,2) NOT NULL,
  `currency` VARCHAR(191) NOT NULL DEFAULT 'INR',
  `status` VARCHAR(191) NOT NULL DEFAULT 'Confirmed',
  `paymentMethod` VARCHAR(191) NULL,
  `paidAt` DATETIME(3) NOT NULL,
  `notes` TEXT NULL,
  `recordedBy` VARCHAR(191) NULL,
  `createdDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedDate` DATETIME(3) NOT NULL,
  INDEX `deal_payment_records_organizationId_status_paidAt_idx`(`organizationId`, `status`, `paidAt`),
  INDEX `deal_payment_records_dealId_paidAt_idx`(`dealId`, `paidAt`),
  PRIMARY KEY (`_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `deal_expense_records` (
  `_id` VARCHAR(191) NOT NULL,
  `organizationId` VARCHAR(191) NOT NULL,
  `dealId` VARCHAR(191) NOT NULL,
  `category` VARCHAR(191) NOT NULL,
  `description` VARCHAR(191) NULL,
  `amount` DECIMAL(18,2) NOT NULL,
  `incurredAt` DATETIME(3) NOT NULL,
  `recordedBy` VARCHAR(191) NULL,
  `createdDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `deal_expense_records_organizationId_incurredAt_idx`(`organizationId`, `incurredAt`),
  INDEX `deal_expense_records_dealId_idx`(`dealId`),
  PRIMARY KEY (`_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
