-- CreateTable
CREATE TABLE `automation_sequence_records` (
    `_id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `triggerType` VARCHAR(191) NOT NULL DEFAULT 'manual',
    `steps` JSON NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'active',
    `pauseOnConversion` BOOLEAN NOT NULL DEFAULT true,
    `createdBy` VARCHAR(191) NULL,
    `createdDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedDate` DATETIME(3) NOT NULL,

    INDEX `automation_sequence_records_organizationId_status_idx`(`organizationId`, `status`),
    UNIQUE INDEX `automation_sequence_records_organizationId_name_key`(`organizationId`, `name`),
    PRIMARY KEY (`_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `automation_enrollment_records` (
    `_id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `sequenceId` VARCHAR(191) NOT NULL,
    `leadId` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'active',
    `currentStep` INTEGER NOT NULL DEFAULT 0,
    `nextRunAt` DATETIME(3) NULL,
    `pausedReason` TEXT NULL,
    `lastError` TEXT NULL,
    `createdBy` VARCHAR(191) NULL,
    `createdDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedDate` DATETIME(3) NOT NULL,

    INDEX `automation_enrollment_org_status_run_idx`(`organizationId`, `status`, `nextRunAt`),
    INDEX `automation_enrollment_records_leadId_createdDate_idx`(`leadId`, `createdDate`),
    PRIMARY KEY (`_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Rename the automatically truncated legacy index to its stable schema name.
CREATE INDEX `reconciliation_org_status_created_idx`
    ON `reconciliation_item_records`(`organizationId`, `status`, `createdDate`);
DROP INDEX `reconciliation_item_records_organizationId_status_createdD_idx`
    ON `reconciliation_item_records`;
