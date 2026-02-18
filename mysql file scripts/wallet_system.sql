-- =====================================================
-- Wallet System Migration Script
-- Adds withdrawal requests and bank accounts tables
-- =====================================================

-- =====================================================
-- Table: provider_bank_accounts
-- Stores bank account information for providers
-- =====================================================
DROP TABLE IF EXISTS `provider_bank_accounts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `provider_bank_accounts` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT (uuid()),
  `tenant_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `provider_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `account_holder_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `bank_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `account_number` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `iban` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `swift_code` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `branch_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_default` tinyint(1) DEFAULT '0',
  `is_verified` tinyint(1) DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_provider` (`provider_id`),
  KEY `idx_tenant_provider` (`tenant_id`,`provider_id`),
  CONSTRAINT `provider_bank_accounts_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE,
  CONSTRAINT `provider_bank_accounts_ibfk_2` FOREIGN KEY (`provider_id`) REFERENCES `service_providers` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

-- =====================================================
-- Table: withdrawal_requests
-- Stores withdrawal requests from providers
-- =====================================================
DROP TABLE IF EXISTS `withdrawal_requests`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `withdrawal_requests` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT (uuid()),
  `tenant_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `provider_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `wallet_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `bank_account_id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `amount` decimal(10,2) NOT NULL,
  `fee` decimal(10,2) DEFAULT '0.00',
  `net_amount` decimal(10,2) NOT NULL,
  `status` enum('pending','approved','rejected','processing','completed','failed') COLLATE utf8mb4_unicode_ci DEFAULT 'pending',
  `notes` text COLLATE utf8mb4_unicode_ci,
  `rejection_reason` text COLLATE utf8mb4_unicode_ci,
  `processed_at` timestamp NULL DEFAULT NULL,
  `completed_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_provider_status` (`provider_id`,`status`),
  KEY `idx_tenant_status` (`tenant_id`,`status`),
  KEY `idx_wallet` (`wallet_id`),
  CONSTRAINT `withdrawal_requests_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE,
  CONSTRAINT `withdrawal_requests_ibfk_2` FOREIGN KEY (`provider_id`) REFERENCES `service_providers` (`id`) ON DELETE CASCADE,
  CONSTRAINT `withdrawal_requests_ibfk_3` FOREIGN KEY (`wallet_id`) REFERENCES `wallets` (`id`) ON DELETE CASCADE,
  CONSTRAINT `withdrawal_requests_ibfk_4` FOREIGN KEY (`bank_account_id`) REFERENCES `provider_bank_accounts` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

-- =====================================================
-- Update wallets table to include provider_id for easier joins
-- =====================================================
ALTER TABLE `wallets` ADD COLUMN `provider_id` varchar(36) DEFAULT NULL AFTER `user_id`;
ALTER TABLE `wallets` ADD KEY `idx_provider_wallet` (`tenant_id`,`provider_id`);

-- =====================================================
-- Create wallet for provider if not exists
-- =====================================================
INSERT INTO wallets (id, tenant_id, user_id, provider_id, balance, currency)
SELECT 
    uuid(),
    sp.tenant_id,
    sp.user_id,
    sp.id,
    0.00,
    'SAR'
FROM service_providers sp
WHERE NOT EXISTS (
    SELECT 1 FROM wallets w 
    WHERE w.user_id = sp.user_id 
    AND w.tenant_id = sp.tenant_id
);

-- =====================================================
-- Update existing wallets with provider_id
-- =====================================================
UPDATE wallets w
JOIN service_providers sp ON w.user_id = sp.user_id AND w.tenant_id = sp.tenant_id
SET w.provider_id = sp.id
WHERE w.provider_id IS NULL;
