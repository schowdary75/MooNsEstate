-- DropIndex
DROP INDEX `custom_field_records_moduleName_key` ON `custom_field_records`;

-- DropIndex
DROP INDEX `role_access_records_roleName_key` ON `role_access_records`;

-- AlterTable
ALTER TABLE `account_records` ADD COLUMN `organizationId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `bank_details_records` ADD COLUMN `organizationId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `contact_records` ADD COLUMN `organizationId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `custom_field_records` ADD COLUMN `organizationId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `document_records` ADD COLUMN `organizationId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `email_records` ADD COLUMN `organizationId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `email_template_records` ADD COLUMN `organizationId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `images_schema_records` ADD COLUMN `organizationId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `invoice_records` ADD COLUMN `organizationId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `lead_records` ADD COLUMN `consentStatus` VARCHAR(191) NOT NULL DEFAULT 'unknown',
    ADD COLUMN `convertedAt` DATETIME(3) NULL,
    ADD COLUMN `firstRespondedAt` DATETIME(3) NULL,
    ADD COLUMN `firstResponseDueAt` DATETIME(3) NULL,
    ADD COLUMN `metaLeadId` VARCHAR(191) NULL,
    ADD COLUMN `nextFollowUpDate` DATETIME(3) NULL,
    ADD COLUMN `notes` TEXT NULL,
    ADD COLUMN `organizationId` VARCHAR(191) NULL,
    ADD COLUMN `phoneE164` VARCHAR(191) NULL,
    ADD COLUMN `preferredLanguage` VARCHAR(191) NOT NULL DEFAULT 'en-IN',
    ADD COLUMN `priority` VARCHAR(191) NOT NULL DEFAULT 'Medium';

-- AlterTable
ALTER TABLE `meeting_records` ADD COLUMN `organizationId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `module_active_records` ADD COLUMN `organizationId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `opportunity_project_records` ADD COLUMN `organizationId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `opportunity_records` ADD COLUMN `leadId` VARCHAR(191) NULL,
    ADD COLUMN `organizationId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `phone_call_records` ADD COLUMN `organizationId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `property_records` ADD COLUMN `latitude` DOUBLE NULL,
    ADD COLUMN `longitude` DOUBLE NULL,
    ADD COLUMN `organizationId` VARCHAR(191) NULL,
    ADD COLUMN `possessionDate` DATETIME(3) NULL,
    ADD COLUMN `priceUpdatedAt` DATETIME(3) NULL,
    ADD COLUMN `published` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `slug` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `quote_records` ADD COLUMN `organizationId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `role_access_records` ADD COLUMN `organizationId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `task_records` ADD COLUMN `organizationId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `text_msg_records` ADD COLUMN `organizationId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `validation_records` ADD COLUMN `organizationId` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `organization_records` (
    `_id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `currency` VARCHAR(191) NOT NULL DEFAULT 'INR',
    `timezone` VARCHAR(191) NOT NULL DEFAULT 'Asia/Kolkata',
    `locale` VARCHAR(191) NOT NULL DEFAULT 'en-IN',
    `logoUrl` VARCHAR(191) NULL,
    `primaryColor` VARCHAR(191) NOT NULL DEFAULT '#0a0a0a',
    `portalEnabled` BOOLEAN NOT NULL DEFAULT true,
    `subscriptionProvider` VARCHAR(191) NOT NULL DEFAULT 'razorpay',
    `recordingRetentionDays` INTEGER NOT NULL DEFAULT 180,
    `createdDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedDate` DATETIME(3) NOT NULL,
    `deleted` BOOLEAN NOT NULL DEFAULT false,

    UNIQUE INDEX `organization_records_slug_key`(`slug`),
    PRIMARY KEY (`_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `organization_domain_records` (
    `_id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `hostname` VARCHAR(191) NOT NULL,
    `verified` BOOLEAN NOT NULL DEFAULT false,
    `createdDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedDate` DATETIME(3) NOT NULL,

    UNIQUE INDEX `organization_domain_records_hostname_key`(`hostname`),
    INDEX `organization_domain_records_organizationId_idx`(`organizationId`),
    PRIMARY KEY (`_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `membership_records` (
    `_id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `role` VARCHAR(191) NOT NULL DEFAULT 'agent',
    `status` VARCHAR(191) NOT NULL DEFAULT 'active',
    `createdDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedDate` DATETIME(3) NOT NULL,

    INDEX `membership_records_userId_idx`(`userId`),
    UNIQUE INDEX `membership_records_organizationId_userId_key`(`organizationId`, `userId`),
    PRIMARY KEY (`_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `session_records` (
    `_id` VARCHAR(191) NOT NULL,
    `tokenHash` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NULL,
    `userAgent` TEXT NULL,
    `ipAddress` VARCHAR(191) NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `lastSeenAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `revokedAt` DATETIME(3) NULL,
    `createdDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `session_records_tokenHash_key`(`tokenHash`),
    INDEX `session_records_userId_expiresAt_idx`(`userId`, `expiresAt`),
    INDEX `session_records_organizationId_idx`(`organizationId`),
    PRIMARY KEY (`_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `audit_event_records` (
    `_id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NULL,
    `actorUserId` VARCHAR(191) NULL,
    `action` VARCHAR(191) NOT NULL,
    `entityType` VARCHAR(191) NULL,
    `entityId` VARCHAR(191) NULL,
    `ipAddress` VARCHAR(191) NULL,
    `metadata` JSON NULL,
    `createdDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `audit_event_records_organizationId_createdDate_idx`(`organizationId`, `createdDate`),
    INDEX `audit_event_records_actorUserId_createdDate_idx`(`actorUserId`, `createdDate`),
    PRIMARY KEY (`_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `follow_up_records` (
    `_id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `leadId` VARCHAR(191) NOT NULL,
    `ownerId` VARCHAR(191) NULL,
    `followUpType` VARCHAR(191) NOT NULL,
    `followUpDate` DATETIME(3) NOT NULL,
    `priority` VARCHAR(191) NOT NULL DEFAULT 'medium',
    `status` VARCHAR(191) NOT NULL DEFAULT 'pending',
    `notes` TEXT NULL,
    `outcome` TEXT NULL,
    `providerJobId` VARCHAR(191) NULL,
    `failureReason` TEXT NULL,
    `completedAt` DATETIME(3) NULL,
    `createdBy` VARCHAR(191) NULL,
    `createdDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedDate` DATETIME(3) NOT NULL,
    `deleted` BOOLEAN NOT NULL DEFAULT false,

    INDEX `follow_up_records_organizationId_followUpDate_idx`(`organizationId`, `followUpDate`),
    INDEX `follow_up_records_leadId_status_idx`(`leadId`, `status`),
    PRIMARY KEY (`_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `activity_event_records` (
    `_id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `leadId` VARCHAR(191) NULL,
    `contactId` VARCHAR(191) NULL,
    `propertyId` VARCHAR(191) NULL,
    `actorUserId` VARCHAR(191) NULL,
    `type` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `metadata` JSON NULL,
    `occurredAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `activity_event_records_organizationId_occurredAt_idx`(`organizationId`, `occurredAt`),
    INDEX `activity_event_records_leadId_occurredAt_idx`(`leadId`, `occurredAt`),
    PRIMARY KEY (`_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `consent_record_records` (
    `_id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `leadId` VARCHAR(191) NULL,
    `buyerProfileId` VARCHAR(191) NULL,
    `channel` VARCHAR(191) NOT NULL,
    `purpose` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL,
    `source` VARCHAR(191) NULL,
    `proof` JSON NULL,
    `capturedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expiresAt` DATETIME(3) NULL,
    `revokedAt` DATETIME(3) NULL,

    INDEX `consent_record_records_organizationId_channel_status_idx`(`organizationId`, `channel`, `status`),
    INDEX `consent_record_records_leadId_idx`(`leadId`),
    PRIMARY KEY (`_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `suppression_entry_records` (
    `_id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `channel` VARCHAR(191) NOT NULL,
    `address` VARCHAR(191) NOT NULL,
    `reason` VARCHAR(191) NOT NULL,
    `provider` VARCHAR(191) NULL,
    `createdDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `suppression_entry_records_organizationId_channel_address_key`(`organizationId`, `channel`, `address`),
    PRIMARY KEY (`_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `channel_account_records` (
    `_id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `channel` VARCHAR(191) NOT NULL,
    `provider` VARCHAR(191) NOT NULL,
    `displayName` VARCHAR(191) NULL,
    `externalId` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'setup_required',
    `encryptedConfig` LONGTEXT NULL,
    `lastHealthAt` DATETIME(3) NULL,
    `createdDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedDate` DATETIME(3) NOT NULL,

    UNIQUE INDEX `channel_account_records_organizationId_channel_provider_key`(`organizationId`, `channel`, `provider`),
    PRIMARY KEY (`_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `conversation_records` (
    `_id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `channelAccountId` VARCHAR(191) NULL,
    `leadId` VARCHAR(191) NULL,
    `contactId` VARCHAR(191) NULL,
    `channel` VARCHAR(191) NOT NULL,
    `providerConversationId` VARCHAR(191) NULL,
    `subject` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'open',
    `priority` VARCHAR(191) NOT NULL DEFAULT 'normal',
    `assignedTo` VARCHAR(191) NULL,
    `unreadCount` INTEGER NOT NULL DEFAULT 0,
    `customerWindowEndsAt` DATETIME(3) NULL,
    `lastMessageAt` DATETIME(3) NULL,
    `createdDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedDate` DATETIME(3) NOT NULL,

    INDEX `conversation_records_organizationId_status_lastMessageAt_idx`(`organizationId`, `status`, `lastMessageAt`),
    INDEX `conversation_records_leadId_channel_idx`(`leadId`, `channel`),
    PRIMARY KEY (`_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `message_records` (
    `_id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `conversationId` VARCHAR(191) NOT NULL,
    `providerMessageId` VARCHAR(191) NULL,
    `direction` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL DEFAULT 'text',
    `sender` VARCHAR(191) NULL,
    `recipient` VARCHAR(191) NULL,
    `text` LONGTEXT NULL,
    `html` LONGTEXT NULL,
    `templateName` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'queued',
    `replyToMessageId` VARCHAR(191) NULL,
    `errorCode` VARCHAR(191) NULL,
    `errorMessage` TEXT NULL,
    `sentAt` DATETIME(3) NULL,
    `deliveredAt` DATETIME(3) NULL,
    `readAt` DATETIME(3) NULL,
    `failedAt` DATETIME(3) NULL,
    `createdBy` VARCHAR(191) NULL,
    `metadata` JSON NULL,
    `createdDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedDate` DATETIME(3) NOT NULL,

    INDEX `message_records_conversationId_createdDate_idx`(`conversationId`, `createdDate`),
    UNIQUE INDEX `message_records_organizationId_providerMessageId_key`(`organizationId`, `providerMessageId`),
    PRIMARY KEY (`_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `message_attachment_records` (
    `_id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `messageId` VARCHAR(191) NOT NULL,
    `fileName` VARCHAR(191) NULL,
    `mimeType` VARCHAR(191) NULL,
    `sizeBytes` INTEGER NULL,
    `storageKey` VARCHAR(191) NULL,
    `providerMediaId` VARCHAR(191) NULL,
    `externalUrl` TEXT NULL,
    `createdDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `message_attachment_records_messageId_idx`(`messageId`),
    PRIMARY KEY (`_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `delivery_event_records` (
    `_id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `messageId` VARCHAR(191) NULL,
    `providerEventId` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL,
    `payload` JSON NULL,
    `occurredAt` DATETIME(3) NOT NULL,
    `createdDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `delivery_event_records_messageId_occurredAt_idx`(`messageId`, `occurredAt`),
    UNIQUE INDEX `delivery_event_records_organizationId_providerEventId_key`(`organizationId`, `providerEventId`),
    PRIMARY KEY (`_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `provider_webhook_event_records` (
    `_id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NULL,
    `provider` VARCHAR(191) NOT NULL,
    `externalEventId` VARCHAR(191) NOT NULL,
    `eventType` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'received',
    `payload` JSON NOT NULL,
    `errorMessage` TEXT NULL,
    `processedAt` DATETIME(3) NULL,
    `receivedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `provider_webhook_event_records_provider_status_receivedAt_idx`(`provider`, `status`, `receivedAt`),
    UNIQUE INDEX `provider_webhook_event_records_provider_externalEventId_key`(`provider`, `externalEventId`),
    PRIMARY KEY (`_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `call_record_records` (
    `_id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `leadId` VARCHAR(191) NULL,
    `contactId` VARCHAR(191) NULL,
    `provider` VARCHAR(191) NOT NULL DEFAULT 'exotel',
    `providerCallId` VARCHAR(191) NULL,
    `direction` VARCHAR(191) NOT NULL,
    `fromNumber` VARCHAR(191) NULL,
    `toNumber` VARCHAR(191) NULL,
    `agentUserId` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'queued',
    `startedAt` DATETIME(3) NULL,
    `answeredAt` DATETIME(3) NULL,
    `endedAt` DATETIME(3) NULL,
    `durationSeconds` INTEGER NULL,
    `consentedToRecording` BOOLEAN NOT NULL DEFAULT false,
    `notes` TEXT NULL,
    `metadata` JSON NULL,
    `createdDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedDate` DATETIME(3) NOT NULL,

    INDEX `call_record_records_leadId_createdDate_idx`(`leadId`, `createdDate`),
    UNIQUE INDEX `call_record_records_organizationId_providerCallId_key`(`organizationId`, `providerCallId`),
    PRIMARY KEY (`_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `call_recording_records` (
    `_id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `callId` VARCHAR(191) NOT NULL,
    `storageKey` VARCHAR(191) NULL,
    `providerUrl` TEXT NULL,
    `mimeType` VARCHAR(191) NULL,
    `durationSeconds` INTEGER NULL,
    `retentionUntil` DATETIME(3) NULL,
    `legalHold` BOOLEAN NOT NULL DEFAULT false,
    `createdDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `call_recording_records_callId_key`(`callId`),
    INDEX `call_recording_records_organizationId_retentionUntil_idx`(`organizationId`, `retentionUntil`),
    PRIMARY KEY (`_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `transcript_records` (
    `_id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `callId` VARCHAR(191) NOT NULL,
    `provider` VARCHAR(191) NOT NULL DEFAULT 'sarvam',
    `providerJobId` VARCHAR(191) NULL,
    `languageCode` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'queued',
    `text` LONGTEXT NULL,
    `diarized` JSON NULL,
    `timestamps` JSON NULL,
    `errorMessage` TEXT NULL,
    `completedAt` DATETIME(3) NULL,
    `createdDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedDate` DATETIME(3) NOT NULL,

    UNIQUE INDEX `transcript_records_callId_key`(`callId`),
    INDEX `transcript_records_organizationId_status_idx`(`organizationId`, `status`),
    PRIMARY KEY (`_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `email_thread_records` (
    `_id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `conversationId` VARCHAR(191) NOT NULL,
    `providerThreadId` VARCHAR(191) NULL,
    `rootMessageId` VARCHAR(191) NULL,
    `references` JSON NULL,
    `createdDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedDate` DATETIME(3) NOT NULL,

    UNIQUE INDEX `email_thread_records_conversationId_key`(`conversationId`),
    INDEX `email_thread_records_organizationId_idx`(`organizationId`),
    PRIMARY KEY (`_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `integration_connection_records` (
    `_id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `provider` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'setup_required',
    `encryptedConfig` LONGTEXT NULL,
    `externalAccountId` VARCHAR(191) NULL,
    `expiresAt` DATETIME(3) NULL,
    `lastSyncAt` DATETIME(3) NULL,
    `lastError` TEXT NULL,
    `createdDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedDate` DATETIME(3) NOT NULL,

    UNIQUE INDEX `integration_connection_records_organizationId_provider_key`(`organizationId`, `provider`),
    PRIMARY KEY (`_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `meta_campaign_records` (
    `_id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `externalId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `objective` VARCHAR(191) NULL,
    `status` VARCHAR(191) NULL,
    `effectiveStatus` VARCHAR(191) NULL,
    `dailyBudget` VARCHAR(191) NULL,
    `lifetimeBudget` VARCHAR(191) NULL,
    `raw` JSON NULL,
    `createdDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedDate` DATETIME(3) NOT NULL,

    UNIQUE INDEX `meta_campaign_records_organizationId_externalId_key`(`organizationId`, `externalId`),
    PRIMARY KEY (`_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `meta_ad_set_records` (
    `_id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `externalId` VARCHAR(191) NOT NULL,
    `campaignExternalId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NULL,
    `targetingSummary` JSON NULL,
    `raw` JSON NULL,
    `createdDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedDate` DATETIME(3) NOT NULL,

    INDEX `meta_ad_set_records_organizationId_campaignExternalId_idx`(`organizationId`, `campaignExternalId`),
    UNIQUE INDEX `meta_ad_set_records_organizationId_externalId_key`(`organizationId`, `externalId`),
    PRIMARY KEY (`_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `meta_ad_records` (
    `_id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `externalId` VARCHAR(191) NOT NULL,
    `campaignExternalId` VARCHAR(191) NOT NULL,
    `adSetExternalId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NULL,
    `creativeId` VARCHAR(191) NULL,
    `creativePreviewUrl` TEXT NULL,
    `raw` JSON NULL,
    `createdDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedDate` DATETIME(3) NOT NULL,

    INDEX `meta_ad_records_organizationId_adSetExternalId_idx`(`organizationId`, `adSetExternalId`),
    UNIQUE INDEX `meta_ad_records_organizationId_externalId_key`(`organizationId`, `externalId`),
    PRIMARY KEY (`_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `meta_lead_form_records` (
    `_id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `externalId` VARCHAR(191) NOT NULL,
    `pageExternalId` VARCHAR(191) NULL,
    `name` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NULL,
    `questions` JSON NULL,
    `raw` JSON NULL,
    `createdDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedDate` DATETIME(3) NOT NULL,

    UNIQUE INDEX `meta_lead_form_records_organizationId_externalId_key`(`organizationId`, `externalId`),
    PRIMARY KEY (`_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `meta_lead_submission_records` (
    `_id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `externalId` VARCHAR(191) NOT NULL,
    `leadId` VARCHAR(191) NULL,
    `campaignExternalId` VARCHAR(191) NULL,
    `adSetExternalId` VARCHAR(191) NULL,
    `adExternalId` VARCHAR(191) NULL,
    `formExternalId` VARCHAR(191) NULL,
    `pageExternalId` VARCHAR(191) NULL,
    `fieldData` JSON NULL,
    `raw` JSON NOT NULL,
    `submittedAt` DATETIME(3) NULL,
    `hydratedAt` DATETIME(3) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'received',
    `createdDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedDate` DATETIME(3) NOT NULL,

    INDEX `meta_lead_submission_records_leadId_idx`(`leadId`),
    UNIQUE INDEX `meta_lead_submission_records_organizationId_externalId_key`(`organizationId`, `externalId`),
    PRIMARY KEY (`_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `meta_insight_daily_records` (
    `_id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `level` VARCHAR(191) NOT NULL,
    `objectExternalId` VARCHAR(191) NOT NULL,
    `insightDate` DATETIME(3) NOT NULL,
    `campaignExternalId` VARCHAR(191) NULL,
    `adSetExternalId` VARCHAR(191) NULL,
    `adExternalId` VARCHAR(191) NULL,
    `spend` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `impressions` INTEGER NOT NULL DEFAULT 0,
    `reach` INTEGER NOT NULL DEFAULT 0,
    `frequency` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    `clicks` INTEGER NOT NULL DEFAULT 0,
    `linkClicks` INTEGER NOT NULL DEFAULT 0,
    `leads` INTEGER NOT NULL DEFAULT 0,
    `landingPageViews` INTEGER NOT NULL DEFAULT 0,
    `messagingConversations` INTEGER NOT NULL DEFAULT 0,
    `actions` JSON NULL,
    `breakdowns` JSON NULL,
    `raw` JSON NULL,
    `createdDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedDate` DATETIME(3) NOT NULL,

    INDEX `meta_insight_daily_records_organizationId_insightDate_idx`(`organizationId`, `insightDate`),
    UNIQUE INDEX `meta_insight_daily_records_organizationId_level_objectExtern_key`(`organizationId`, `level`, `objectExternalId`, `insightDate`),
    PRIMARY KEY (`_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `attribution_touch_records` (
    `_id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `leadId` VARCHAR(191) NOT NULL,
    `source` VARCHAR(191) NOT NULL,
    `campaignExternalId` VARCHAR(191) NULL,
    `adSetExternalId` VARCHAR(191) NULL,
    `adExternalId` VARCHAR(191) NULL,
    `formExternalId` VARCHAR(191) NULL,
    `referral` JSON NULL,
    `occurredAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `attribution_touch_records_leadId_occurredAt_idx`(`leadId`, `occurredAt`),
    PRIMARY KEY (`_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `conversion_dispatch_records` (
    `_id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `leadId` VARCHAR(191) NOT NULL,
    `eventName` VARCHAR(191) NOT NULL,
    `eventId` VARCHAR(191) NOT NULL,
    `provider` VARCHAR(191) NOT NULL DEFAULT 'meta',
    `status` VARCHAR(191) NOT NULL DEFAULT 'queued',
    `payload` JSON NOT NULL,
    `attempts` INTEGER NOT NULL DEFAULT 0,
    `lastError` TEXT NULL,
    `dispatchedAt` DATETIME(3) NULL,
    `createdDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedDate` DATETIME(3) NOT NULL,

    INDEX `conversion_dispatch_records_status_createdDate_idx`(`status`, `createdDate`),
    UNIQUE INDEX `conversion_dispatch_records_organizationId_eventId_key`(`organizationId`, `eventId`),
    PRIMARY KEY (`_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `buyer_profile_records` (
    `_id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NULL,
    `phoneE164` VARCHAR(191) NULL,
    `fullName` VARCHAR(191) NULL,
    `preferredLanguage` VARCHAR(191) NOT NULL DEFAULT 'en-IN',
    `budgetMin` DECIMAL(18, 2) NULL,
    `budgetMax` DECIMAL(18, 2) NULL,
    `preferences` JSON NULL,
    `createdDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedDate` DATETIME(3) NOT NULL,

    INDEX `buyer_profile_records_organizationId_phoneE164_idx`(`organizationId`, `phoneE164`),
    UNIQUE INDEX `buyer_profile_records_organizationId_email_key`(`organizationId`, `email`),
    PRIMARY KEY (`_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `passwordless_token_records` (
    `_id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `buyerProfileId` VARCHAR(191) NULL,
    `email` VARCHAR(191) NOT NULL,
    `tokenHash` VARCHAR(191) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `consumedAt` DATETIME(3) NULL,
    `createdDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `passwordless_token_records_tokenHash_key`(`tokenHash`),
    INDEX `passwordless_token_records_organizationId_email_idx`(`organizationId`, `email`),
    PRIMARY KEY (`_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `shortlist_records` (
    `_id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `buyerProfileId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL DEFAULT 'My shortlist',
    `createdDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedDate` DATETIME(3) NOT NULL,

    INDEX `shortlist_records_buyerProfileId_idx`(`buyerProfileId`),
    PRIMARY KEY (`_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `shortlist_item_records` (
    `_id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `shortlistId` VARCHAR(191) NOT NULL,
    `propertyId` VARCHAR(191) NOT NULL,
    `notes` TEXT NULL,
    `createdDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `shortlist_item_records_organizationId_propertyId_idx`(`organizationId`, `propertyId`),
    UNIQUE INDEX `shortlist_item_records_shortlistId_propertyId_key`(`shortlistId`, `propertyId`),
    PRIMARY KEY (`_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `site_visit_records` (
    `_id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `leadId` VARCHAR(191) NULL,
    `buyerProfileId` VARCHAR(191) NULL,
    `propertyId` VARCHAR(191) NOT NULL,
    `assignedTo` VARCHAR(191) NULL,
    `scheduledAt` DATETIME(3) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'scheduled',
    `notes` TEXT NULL,
    `outcome` TEXT NULL,
    `createdDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedDate` DATETIME(3) NOT NULL,

    INDEX `site_visit_records_organizationId_scheduledAt_idx`(`organizationId`, `scheduledAt`),
    INDEX `site_visit_records_leadId_idx`(`leadId`),
    PRIMARY KEY (`_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `real_estate_project_records` (
    `_id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `builder` VARCHAR(191) NULL,
    `location` VARCHAR(191) NULL,
    `address` TEXT NULL,
    `reraId` VARCHAR(191) NULL,
    `latitude` DOUBLE NULL,
    `longitude` DOUBLE NULL,
    `possessionDate` DATETIME(3) NULL,
    `published` BOOLEAN NOT NULL DEFAULT false,
    `createdDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedDate` DATETIME(3) NOT NULL,

    UNIQUE INDEX `real_estate_project_records_organizationId_slug_key`(`organizationId`, `slug`),
    PRIMARY KEY (`_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `property_tower_records` (
    `_id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `totalFloors` INTEGER NOT NULL,
    `createdDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedDate` DATETIME(3) NOT NULL,

    INDEX `property_tower_records_organizationId_idx`(`organizationId`),
    UNIQUE INDEX `property_tower_records_projectId_name_key`(`projectId`, `name`),
    PRIMARY KEY (`_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `property_floor_records` (
    `_id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `towerId` VARCHAR(191) NOT NULL,
    `floorNumber` INTEGER NOT NULL,
    `label` VARCHAR(191) NULL,
    `createdDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `property_floor_records_organizationId_idx`(`organizationId`),
    UNIQUE INDEX `property_floor_records_towerId_floorNumber_key`(`towerId`, `floorNumber`),
    PRIMARY KEY (`_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `property_unit_records` (
    `_id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `floorId` VARCHAR(191) NOT NULL,
    `propertyId` VARCHAR(191) NULL,
    `unitNumber` VARCHAR(191) NOT NULL,
    `bedrooms` INTEGER NULL,
    `bathrooms` INTEGER NULL,
    `carpetArea` INTEGER NULL,
    `facing` VARCHAR(191) NULL,
    `listingPrice` DECIMAL(18, 2) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'Available',
    `createdDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedDate` DATETIME(3) NOT NULL,

    INDEX `property_unit_records_organizationId_status_idx`(`organizationId`, `status`),
    UNIQUE INDEX `property_unit_records_floorId_unitNumber_key`(`floorId`, `unitNumber`),
    PRIMARY KEY (`_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `property_media_records` (
    `_id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `propertyId` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `url` TEXT NOT NULL,
    `label` VARCHAR(191) NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `createdDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `property_media_records_propertyId_sortOrder_idx`(`propertyId`, `sortOrder`),
    PRIMARY KEY (`_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `floor_plan_records` (
    `_id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `propertyId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NULL,
    `url` TEXT NOT NULL,
    `metadata` JSON NULL,
    `createdDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `floor_plan_records_propertyId_idx`(`propertyId`),
    PRIMARY KEY (`_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `availability_event_records` (
    `_id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `propertyUnitId` VARCHAR(191) NOT NULL,
    `fromStatus` VARCHAR(191) NULL,
    `toStatus` VARCHAR(191) NOT NULL,
    `actorUserId` VARCHAR(191) NULL,
    `occurredAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `availability_event_records_propertyUnitId_occurredAt_idx`(`propertyUnitId`, `occurredAt`),
    PRIMARY KEY (`_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `plan_records` (
    `_id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `currency` VARCHAR(191) NOT NULL DEFAULT 'INR',
    `monthlyPrice` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `annualPrice` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    `razorpayMonthlyPlanId` VARCHAR(191) NULL,
    `razorpayAnnualPlanId` VARCHAR(191) NULL,
    `stripeMonthlyPriceId` VARCHAR(191) NULL,
    `stripeAnnualPriceId` VARCHAR(191) NULL,
    `includedSeats` INTEGER NOT NULL DEFAULT 1,
    `includedLeads` INTEGER NOT NULL DEFAULT 1000,
    `includedStorageMb` INTEGER NOT NULL DEFAULT 1024,
    `includedMessages` INTEGER NOT NULL DEFAULT 1000,
    `includedTranscriptionMinutes` INTEGER NOT NULL DEFAULT 60,
    `features` JSON NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `createdDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedDate` DATETIME(3) NOT NULL,

    UNIQUE INDEX `plan_records_code_key`(`code`),
    PRIMARY KEY (`_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `subscription_records` (
    `_id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `planId` VARCHAR(191) NOT NULL,
    `provider` VARCHAR(191) NOT NULL,
    `providerCustomerId` VARCHAR(191) NULL,
    `providerSubscriptionId` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'trialing',
    `billingInterval` VARCHAR(191) NOT NULL DEFAULT 'monthly',
    `quantity` INTEGER NOT NULL DEFAULT 1,
    `trialEndsAt` DATETIME(3) NULL,
    `currentPeriodStart` DATETIME(3) NULL,
    `currentPeriodEnd` DATETIME(3) NULL,
    `graceEndsAt` DATETIME(3) NULL,
    `cancelAtPeriodEnd` BOOLEAN NOT NULL DEFAULT false,
    `createdDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedDate` DATETIME(3) NOT NULL,

    INDEX `subscription_records_organizationId_status_idx`(`organizationId`, `status`),
    UNIQUE INDEX `subscription_records_provider_providerSubscriptionId_key`(`provider`, `providerSubscriptionId`),
    PRIMARY KEY (`_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `entitlement_records` (
    `_id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `key` VARCHAR(191) NOT NULL,
    `value` VARCHAR(191) NOT NULL,
    `source` VARCHAR(191) NOT NULL DEFAULT 'plan',
    `expiresAt` DATETIME(3) NULL,
    `createdDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedDate` DATETIME(3) NOT NULL,

    UNIQUE INDEX `entitlement_records_organizationId_key_key`(`organizationId`, `key`),
    PRIMARY KEY (`_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `usage_ledger_records` (
    `_id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `usageType` VARCHAR(191) NOT NULL,
    `quantity` DECIMAL(18, 4) NOT NULL,
    `referenceType` VARCHAR(191) NULL,
    `referenceId` VARCHAR(191) NULL,
    `occurredAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `metadata` JSON NULL,

    INDEX `usage_ledger_records_organizationId_usageType_occurredAt_idx`(`organizationId`, `usageType`, `occurredAt`),
    PRIMARY KEY (`_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `billing_event_records` (
    `_id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NULL,
    `provider` VARCHAR(191) NOT NULL,
    `providerEventId` VARCHAR(191) NOT NULL,
    `eventType` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'received',
    `payload` JSON NOT NULL,
    `processedAt` DATETIME(3) NULL,
    `createdDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `billing_event_records_organizationId_createdDate_idx`(`organizationId`, `createdDate`),
    UNIQUE INDEX `billing_event_records_provider_providerEventId_key`(`provider`, `providerEventId`),
    PRIMARY KEY (`_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `account_records_organizationId_createdDate_idx` ON `account_records`(`organizationId`, `createdDate`);

-- CreateIndex
CREATE INDEX `bank_details_records_organizationId_idx` ON `bank_details_records`(`organizationId`);

-- CreateIndex
CREATE INDEX `contact_records_organizationId_createdDate_idx` ON `contact_records`(`organizationId`, `createdDate`);

-- CreateIndex
CREATE UNIQUE INDEX `custom_field_records_organizationId_moduleName_key` ON `custom_field_records`(`organizationId`, `moduleName`);

-- CreateIndex
CREATE INDEX `document_records_organizationId_createdDate_idx` ON `document_records`(`organizationId`, `createdDate`);

-- CreateIndex
CREATE INDEX `email_records_organizationId_createdDate_idx` ON `email_records`(`organizationId`, `createdDate`);

-- CreateIndex
CREATE INDEX `email_template_records_organizationId_idx` ON `email_template_records`(`organizationId`);

-- CreateIndex
CREATE INDEX `images_schema_records_organizationId_idx` ON `images_schema_records`(`organizationId`);

-- CreateIndex
CREATE INDEX `invoice_records_organizationId_status_idx` ON `invoice_records`(`organizationId`, `status`);

-- CreateIndex
CREATE INDEX `lead_records_organizationId_createdDate_idx` ON `lead_records`(`organizationId`, `createdDate`);

-- CreateIndex
CREATE INDEX `lead_records_organizationId_phoneE164_idx` ON `lead_records`(`organizationId`, `phoneE164`);

-- CreateIndex
CREATE INDEX `lead_records_organizationId_leadEmail_idx` ON `lead_records`(`organizationId`, `leadEmail`);

-- CreateIndex
CREATE UNIQUE INDEX `lead_records_organizationId_metaLeadId_key` ON `lead_records`(`organizationId`, `metaLeadId`);

-- CreateIndex
CREATE INDEX `meeting_records_organizationId_createdDate_idx` ON `meeting_records`(`organizationId`, `createdDate`);

-- CreateIndex
CREATE INDEX `module_active_records_organizationId_idx` ON `module_active_records`(`organizationId`);

-- CreateIndex
CREATE INDEX `opportunity_project_records_organizationId_idx` ON `opportunity_project_records`(`organizationId`);

-- CreateIndex
CREATE INDEX `opportunity_records_organizationId_stage_idx` ON `opportunity_records`(`organizationId`, `stage`);

-- CreateIndex
CREATE INDEX `opportunity_records_leadId_idx` ON `opportunity_records`(`leadId`);

-- CreateIndex
CREATE INDEX `phone_call_records_organizationId_createdDate_idx` ON `phone_call_records`(`organizationId`, `createdDate`);

-- CreateIndex
CREATE INDEX `property_records_organizationId_status_idx` ON `property_records`(`organizationId`, `status`);

-- CreateIndex
CREATE UNIQUE INDEX `property_records_organizationId_slug_key` ON `property_records`(`organizationId`, `slug`);

-- CreateIndex
CREATE INDEX `quote_records_organizationId_status_idx` ON `quote_records`(`organizationId`, `status`);

-- CreateIndex
CREATE UNIQUE INDEX `role_access_records_organizationId_roleName_key` ON `role_access_records`(`organizationId`, `roleName`);

-- CreateIndex
CREATE INDEX `task_records_organizationId_status_idx` ON `task_records`(`organizationId`, `status`);

-- CreateIndex
CREATE INDEX `text_msg_records_organizationId_createdDate_idx` ON `text_msg_records`(`organizationId`, `createdDate`);

-- CreateIndex
CREATE INDEX `validation_records_organizationId_idx` ON `validation_records`(`organizationId`);

-- AddForeignKey
ALTER TABLE `membership_records` ADD CONSTRAINT `membership_records_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organization_records`(`_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `membership_records` ADD CONSTRAINT `membership_records_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user_records`(`_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `session_records` ADD CONSTRAINT `session_records_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user_records`(`_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `session_records` ADD CONSTRAINT `session_records_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organization_records`(`_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `subscription_records` ADD CONSTRAINT `subscription_records_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organization_records`(`_id`) ON DELETE CASCADE ON UPDATE CASCADE;
