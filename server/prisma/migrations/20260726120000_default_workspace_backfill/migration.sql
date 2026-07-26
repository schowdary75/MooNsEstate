INSERT INTO `organization_records` (
  `_id`, `name`, `slug`, `currency`, `timezone`, `locale`,
  `primaryColor`, `portalEnabled`, `subscriptionProvider`,
  `recordingRetentionDays`, `createdDate`, `updatedDate`, `deleted`
)
SELECT
  UUID(), 'MooN Estates', 'moon-estates', 'INR', 'Asia/Kolkata', 'en-IN',
  '#0a0a0a', true, 'razorpay', 180, NOW(3), NOW(3), false
WHERE NOT EXISTS (
  SELECT 1 FROM `organization_records` WHERE `slug` = 'moon-estates'
);

SET @default_organization_id = (
  SELECT `_id` FROM `organization_records` WHERE `slug` = 'moon-estates' LIMIT 1
);

INSERT INTO `membership_records` (
  `_id`, `organizationId`, `userId`, `role`, `status`, `createdDate`, `updatedDate`
)
SELECT
  UUID(), @default_organization_id, `_id`,
  CASE WHEN `role` = 'superAdmin' THEN 'organization_owner' ELSE 'agent' END,
  'active', NOW(3), NOW(3)
FROM `user_records`
WHERE `deleted` = false
  AND NOT EXISTS (
    SELECT 1
    FROM `membership_records`
    WHERE `membership_records`.`organizationId` = @default_organization_id
      AND `membership_records`.`userId` = `user_records`.`_id`
  );

UPDATE `account_records` SET `organizationId` = @default_organization_id WHERE `organizationId` IS NULL;
UPDATE `bank_details_records` SET `organizationId` = @default_organization_id WHERE `organizationId` IS NULL;
UPDATE `contact_records` SET `organizationId` = @default_organization_id WHERE `organizationId` IS NULL;
UPDATE `custom_field_records` SET `organizationId` = @default_organization_id WHERE `organizationId` IS NULL;
UPDATE `document_records` SET `organizationId` = @default_organization_id WHERE `organizationId` IS NULL;
UPDATE `email_records` SET `organizationId` = @default_organization_id WHERE `organizationId` IS NULL;
UPDATE `email_template_records` SET `organizationId` = @default_organization_id WHERE `organizationId` IS NULL;
UPDATE `images_schema_records` SET `organizationId` = @default_organization_id WHERE `organizationId` IS NULL;
UPDATE `invoice_records` SET `organizationId` = @default_organization_id WHERE `organizationId` IS NULL;
UPDATE `lead_records` SET `organizationId` = @default_organization_id WHERE `organizationId` IS NULL;
UPDATE `meeting_records` SET `organizationId` = @default_organization_id WHERE `organizationId` IS NULL;
UPDATE `module_active_records` SET `organizationId` = @default_organization_id WHERE `organizationId` IS NULL;
UPDATE `opportunity_project_records` SET `organizationId` = @default_organization_id WHERE `organizationId` IS NULL;
UPDATE `opportunity_records` SET `organizationId` = @default_organization_id WHERE `organizationId` IS NULL;
UPDATE `phone_call_records` SET `organizationId` = @default_organization_id WHERE `organizationId` IS NULL;
UPDATE `property_records`
SET
  `organizationId` = @default_organization_id,
  `slug` = COALESCE(`slug`, CONCAT('property-', LEFT(REPLACE(`_id`, '-', ''), 16))),
  `priceUpdatedAt` = COALESCE(`priceUpdatedAt`, `updatedDate`)
WHERE `organizationId` IS NULL OR `slug` IS NULL OR `priceUpdatedAt` IS NULL;
UPDATE `quote_records` SET `organizationId` = @default_organization_id WHERE `organizationId` IS NULL;
UPDATE `role_access_records` SET `organizationId` = @default_organization_id WHERE `organizationId` IS NULL;
UPDATE `task_records` SET `organizationId` = @default_organization_id WHERE `organizationId` IS NULL;
UPDATE `text_msg_records` SET `organizationId` = @default_organization_id WHERE `organizationId` IS NULL;
UPDATE `validation_records` SET `organizationId` = @default_organization_id WHERE `organizationId` IS NULL;

INSERT INTO `plan_records` (
  `_id`, `code`, `name`, `description`, `currency`, `monthlyPrice`, `annualPrice`,
  `includedSeats`, `includedLeads`, `includedStorageMb`, `includedMessages`,
  `includedTranscriptionMinutes`, `active`, `createdDate`, `updatedDate`
)
SELECT
  UUID(), 'starter', 'Starter',
  'For focused real-estate teams starting their digital sales desk.',
  'INR', 0, 0, 3, 2500, 1024, 2000, 120, true, NOW(3), NOW(3)
WHERE NOT EXISTS (SELECT 1 FROM `plan_records` WHERE `code` = 'starter');

INSERT INTO `plan_records` (
  `_id`, `code`, `name`, `description`, `currency`, `monthlyPrice`, `annualPrice`,
  `includedSeats`, `includedLeads`, `includedStorageMb`, `includedMessages`,
  `includedTranscriptionMinutes`, `active`, `createdDate`, `updatedDate`
)
SELECT
  UUID(), 'growth', 'Growth',
  'For brokerages scaling Meta acquisition and omnichannel follow-up.',
  'INR', 0, 0, 10, 15000, 10240, 15000, 1000, true, NOW(3), NOW(3)
WHERE NOT EXISTS (SELECT 1 FROM `plan_records` WHERE `code` = 'growth');

INSERT INTO `plan_records` (
  `_id`, `code`, `name`, `description`, `currency`, `monthlyPrice`, `annualPrice`,
  `includedSeats`, `includedLeads`, `includedStorageMb`, `includedMessages`,
  `includedTranscriptionMinutes`, `active`, `createdDate`, `updatedDate`
)
SELECT
  UUID(), 'enterprise', 'Enterprise',
  'For multi-office organizations requiring custom limits and controls.',
  'INR', 0, 0, 50, 100000, 102400, 100000, 10000, true, NOW(3), NOW(3)
WHERE NOT EXISTS (SELECT 1 FROM `plan_records` WHERE `code` = 'enterprise');

SET @starter_plan_id = (
  SELECT `_id` FROM `plan_records` WHERE `code` = 'starter' LIMIT 1
);

INSERT INTO `subscription_records` (
  `_id`, `organizationId`, `planId`, `provider`, `status`, `billingInterval`,
  `quantity`, `trialEndsAt`, `currentPeriodStart`, `currentPeriodEnd`,
  `cancelAtPeriodEnd`, `createdDate`, `updatedDate`
)
SELECT
  UUID(), @default_organization_id, @starter_plan_id, 'razorpay', 'trialing',
  'monthly', 1, DATE_ADD(NOW(3), INTERVAL 14 DAY), NOW(3),
  DATE_ADD(NOW(3), INTERVAL 14 DAY), false, NOW(3), NOW(3)
WHERE NOT EXISTS (
  SELECT 1 FROM `subscription_records`
  WHERE `organizationId` = @default_organization_id
);
