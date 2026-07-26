ALTER TABLE `membership_records` ADD COLUMN `roleId` VARCHAR(191) NULL;

CREATE TABLE `role_records` (
  `_id` VARCHAR(191) NOT NULL,
  `organizationId` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `label` VARCHAR(191) NOT NULL,
  `description` TEXT NULL,
  `system` BOOLEAN NOT NULL DEFAULT false,
  `createdDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedDate` DATETIME(3) NOT NULL,
  UNIQUE INDEX `role_records_organizationId_name_key` (`organizationId`, `name`),
  PRIMARY KEY (`_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `permission_records` (
  `_id` VARCHAR(191) NOT NULL,
  `organizationId` VARCHAR(191) NOT NULL,
  `key` VARCHAR(191) NOT NULL,
  `description` TEXT NULL,
  `createdDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `permission_records_organizationId_key_key` (`organizationId`, `key`),
  PRIMARY KEY (`_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `role_permission_records` (
  `_id` VARCHAR(191) NOT NULL,
  `organizationId` VARCHAR(191) NOT NULL,
  `roleId` VARCHAR(191) NOT NULL,
  `permissionId` VARCHAR(191) NOT NULL,
  `createdDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `role_permission_records_organizationId_idx` (`organizationId`),
  UNIQUE INDEX `role_permission_records_roleId_permissionId_key` (`roleId`, `permissionId`),
  PRIMARY KEY (`_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX `membership_records_roleId_idx` ON `membership_records` (`roleId`);

ALTER TABLE `role_records`
  ADD CONSTRAINT `role_records_organizationId_fkey`
  FOREIGN KEY (`organizationId`) REFERENCES `organization_records` (`_id`)
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `permission_records`
  ADD CONSTRAINT `permission_records_organizationId_fkey`
  FOREIGN KEY (`organizationId`) REFERENCES `organization_records` (`_id`)
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `role_permission_records`
  ADD CONSTRAINT `role_permission_records_roleId_fkey`
  FOREIGN KEY (`roleId`) REFERENCES `role_records` (`_id`)
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `role_permission_records`
  ADD CONSTRAINT `role_permission_records_permissionId_fkey`
  FOREIGN KEY (`permissionId`) REFERENCES `permission_records` (`_id`)
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `membership_records`
  ADD CONSTRAINT `membership_records_roleId_fkey`
  FOREIGN KEY (`roleId`) REFERENCES `role_records` (`_id`)
  ON DELETE SET NULL ON UPDATE CASCADE;
