ALTER TABLE `real_estate_project_records`
  ADD COLUMN `developerId` VARCHAR(191) NULL;

CREATE INDEX `real_estate_project_records_developerId_idx`
  ON `real_estate_project_records`(`developerId`);

CREATE TABLE `developer_profile_records` (
  `_id` VARCHAR(191) NOT NULL,
  `organizationId` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `legalName` VARCHAR(191) NULL,
  `profileType` VARCHAR(191) NOT NULL DEFAULT 'Developer',
  `reraRegistration` VARCHAR(191) NULL,
  `gstin` VARCHAR(191) NULL,
  `website` VARCHAR(191) NULL,
  `email` VARCHAR(191) NULL,
  `phone` VARCHAR(191) NULL,
  `contactPerson` VARCHAR(191) NULL,
  `address` TEXT NULL,
  `status` VARCHAR(191) NOT NULL DEFAULT 'Active',
  `notes` TEXT NULL,
  `createdBy` VARCHAR(191) NULL,
  `createdDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedDate` DATETIME(3) NOT NULL,
  UNIQUE INDEX `developer_profile_org_name_key`(`organizationId`, `name`),
  INDEX `developer_profile_org_status_idx`(`organizationId`, `status`),
  PRIMARY KEY (`_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
