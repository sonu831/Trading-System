-- CreateTable
CREATE TABLE "broker_providers" (
    "id" SERIAL NOT NULL,
    "provider" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "role" TEXT NOT NULL DEFAULT 'data',
    "priority" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT DEFAULT 'DISCONNECTED',
    "last_tested_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "broker_providers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "broker_providers_provider_key" ON "broker_providers"("provider");

-- CreateIndex
CREATE INDEX "idx_broker_providers_role" ON "broker_providers"("role");

-- CreateIndex
CREATE INDEX "idx_broker_providers_enabled" ON "broker_providers"("enabled");

-- CreateTable
CREATE TABLE "broker_credentials" (
    "id" SERIAL NOT NULL,
    "provider_id" INTEGER NOT NULL,
    "field_name" TEXT NOT NULL,
    "ciphertext" TEXT NOT NULL,
    "iv" TEXT NOT NULL,
    "tag" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "broker_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "broker_credentials_provider_id_field_name_key" ON "broker_credentials"("provider_id", "field_name");

-- AddForeignKey
ALTER TABLE "broker_credentials" ADD CONSTRAINT "broker_credentials_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "broker_providers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "broker_sessions" (
    "id" SERIAL NOT NULL,
    "provider" TEXT NOT NULL,
    "token_hash" TEXT,
    "status" TEXT DEFAULT 'DISCONNECTED',
    "expires_at" TIMESTAMPTZ(6),
    "last_login_at" TIMESTAMPTZ(6),
    "last_error" TEXT,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "broker_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "broker_sessions_provider_key" ON "broker_sessions"("provider");
