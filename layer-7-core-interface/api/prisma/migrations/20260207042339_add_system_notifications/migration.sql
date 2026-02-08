-- CreateTable
CREATE TABLE "api_keys" (
    "id" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "user_id" INTEGER,
    "vendor_name" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "rate_limit" INTEGER NOT NULL DEFAULT 10,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" SERIAL NOT NULL,
    "time" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "event_type" TEXT NOT NULL,
    "entity_type" TEXT,
    "entity_id" TEXT,
    "action" TEXT,
    "details" JSONB,
    "user_id" INTEGER,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("time","id")
);

-- CreateTable
CREATE TABLE "backfill_jobs" (
    "id" SERIAL NOT NULL,
    "job_id" UUID DEFAULT gen_random_uuid(),
    "status" TEXT DEFAULT 'PENDING',
    "symbols" TEXT[],
    "timeframe" TEXT,
    "start_date" DATE,
    "end_date" DATE,
    "total_records" BIGINT DEFAULT 0,
    "processed" BIGINT DEFAULT 0,
    "errors" JSONB DEFAULT '[]',
    "started_at" TIMESTAMPTZ(6),
    "completed_at" TIMESTAMPTZ(6),
    "triggered_by" TEXT,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "backfill_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "candles_1m" (
    "time" TIMESTAMPTZ(6) NOT NULL,
    "symbol" TEXT NOT NULL,
    "exchange" TEXT DEFAULT 'NSE',
    "open" DECIMAL(12,2) NOT NULL,
    "high" DECIMAL(12,2) NOT NULL,
    "low" DECIMAL(12,2) NOT NULL,
    "close" DECIMAL(12,2) NOT NULL,
    "volume" BIGINT DEFAULT 0,
    "vwap" DECIMAL(12,2),
    "trades" INTEGER DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "candles_1m_pkey" PRIMARY KEY ("time","symbol")
);

-- CreateTable
CREATE TABLE "data_availability" (
    "id" SERIAL NOT NULL,
    "symbol" TEXT NOT NULL,
    "timeframe" TEXT NOT NULL,
    "first_date" DATE NOT NULL,
    "last_date" DATE NOT NULL,
    "total_records" BIGINT DEFAULT 0,
    "gaps" JSONB DEFAULT '[]',
    "quality_score" DECIMAL(5,2),
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "data_availability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "instruments" (
    "id" SERIAL NOT NULL,
    "symbol" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isin" TEXT,
    "exchange" TEXT DEFAULT 'NSE',
    "sector_id" INTEGER,
    "industry" TEXT,
    "lot_size" INTEGER DEFAULT 1,
    "tick_size" DECIMAL(6,2) DEFAULT 0.05,
    "token" TEXT,
    "is_nifty50" BOOLEAN DEFAULT false,
    "is_active" BOOLEAN DEFAULT true,
    "listed_date" DATE,
    "face_value" DECIMAL(10,2),
    "market_cap" BIGINT,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "instruments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER,
    "payment_id" INTEGER,
    "invoice_number" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "tax" DECIMAL(10,2) DEFAULT 0,
    "total" DECIMAL(10,2) NOT NULL,
    "status" TEXT DEFAULT 'DRAFT',
    "due_date" DATE,
    "paid_at" TIMESTAMPTZ(6),
    "pdf_url" TEXT,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "market_breadth" (
    "time" TIMESTAMPTZ(6) NOT NULL,
    "advancing" INTEGER,
    "declining" INTEGER,
    "unchanged" INTEGER,
    "ad_ratio" DECIMAL(6,4),
    "new_highs" INTEGER,
    "new_lows" INTEGER,
    "above_vwap_pct" DECIMAL(5,2),
    "above_200ema_pct" DECIMAL(5,2),
    "mcclellan_oscillator" DECIMAL(8,4),

    CONSTRAINT "market_breadth_pkey" PRIMARY KEY ("time")
);

-- CreateTable
CREATE TABLE "options_chain" (
    "time" TIMESTAMPTZ(6) NOT NULL,
    "symbol" TEXT NOT NULL,
    "expiry" DATE NOT NULL,
    "strike" DECIMAL(10,2) NOT NULL,
    "option_type" TEXT NOT NULL,
    "ltp" DECIMAL(10,2),
    "open_interest" BIGINT,
    "volume" BIGINT,
    "iv" DECIMAL(8,4),
    "delta" DECIMAL(8,4),
    "gamma" DECIMAL(8,4),
    "theta" DECIMAL(8,4),
    "vega" DECIMAL(8,4),
    "bid" DECIMAL(10,2),
    "ask" DECIMAL(10,2),

    CONSTRAINT "options_chain_pkey" PRIMARY KEY ("time","symbol","expiry","strike","option_type")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER,
    "subscription_id" INTEGER,
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" TEXT DEFAULT 'INR',
    "status" TEXT DEFAULT 'PENDING',
    "payment_method" TEXT,
    "gateway_order_id" TEXT,
    "gateway_payment_id" TEXT,
    "metadata" JSONB DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ(6),

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plans" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "description" TEXT,
    "price_monthly" DECIMAL(10,2) DEFAULT 0,
    "price_yearly" DECIMAL(10,2) DEFAULT 0,
    "currency" TEXT DEFAULT 'INR',
    "features" JSONB DEFAULT '{}',
    "is_active" BOOLEAN DEFAULT true,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sector_strength" (
    "time" TIMESTAMPTZ(6) NOT NULL,
    "sector" TEXT NOT NULL,
    "strength_score" DECIMAL(5,4),
    "rotation_phase" TEXT,
    "top_stock" TEXT,
    "bottom_stock" TEXT,

    CONSTRAINT "sector_strength_pkey" PRIMARY KEY ("time","sector")
);

-- CreateTable
CREATE TABLE "sectors" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "display_name" TEXT,
    "description" TEXT,
    "weight" DECIMAL(5,2),
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sectors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "signals" (
    "id" SERIAL NOT NULL,
    "time" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "signal_type" TEXT NOT NULL,
    "strength" TEXT,
    "instrument" TEXT NOT NULL,
    "entry_price" DECIMAL(10,2),
    "stop_loss" DECIMAL(10,2),
    "target" DECIMAL(10,2),
    "confidence" DECIMAL(5,2),
    "composite_score" DECIMAL(5,4),
    "trend_score" DECIMAL(5,4),
    "breadth_score" DECIMAL(5,4),
    "momentum_score" DECIMAL(5,4),
    "options_score" DECIMAL(5,4),
    "sector_score" DECIMAL(5,4),
    "volatility_score" DECIMAL(5,4),
    "nifty_price" DECIMAL(10,2),
    "market_regime" TEXT,
    "executed" BOOLEAN DEFAULT false,
    "notes" TEXT,

    CONSTRAINT "signals_pkey" PRIMARY KEY ("time","id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER,
    "plan_id" INTEGER,
    "status" TEXT DEFAULT 'ACTIVE',
    "billing_cycle" TEXT DEFAULT 'MONTHLY',
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "auto_renew" BOOLEAN DEFAULT true,
    "cancelled_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_config" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "description" TEXT,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_by" TEXT,

    CONSTRAINT "system_config_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "technical_indicators" (
    "time" TIMESTAMPTZ(6) NOT NULL,
    "symbol" TEXT NOT NULL,
    "timeframe" TEXT NOT NULL,
    "ema_9" DECIMAL(12,2),
    "ema_21" DECIMAL(12,2),
    "ema_50" DECIMAL(12,2),
    "ema_200" DECIMAL(12,2),
    "sma_20" DECIMAL(12,2),
    "rsi_14" DECIMAL(8,4),
    "macd" DECIMAL(12,4),
    "macd_signal" DECIMAL(12,4),
    "macd_histogram" DECIMAL(12,4),
    "atr_14" DECIMAL(12,4),
    "bb_upper" DECIMAL(12,2),
    "bb_middle" DECIMAL(12,2),
    "bb_lower" DECIMAL(12,2),
    "vwap" DECIMAL(12,2),
    "obv" BIGINT,
    "trend_score" DECIMAL(5,4),
    "momentum_score" DECIMAL(5,4),
    "volatility_score" DECIMAL(5,4),

    CONSTRAINT "technical_indicators_pkey" PRIMARY KEY ("time","symbol","timeframe")
);

-- CreateTable
CREATE TABLE "trading_calendar" (
    "date" DATE NOT NULL,
    "is_trading_day" BOOLEAN DEFAULT true,
    "holiday_name" TEXT,
    "market_open" TIME(6) DEFAULT '09:15:00'::time without time zone,
    "market_close" TIME(6) DEFAULT '15:30:00'::time without time zone,
    "is_special" BOOLEAN DEFAULT false,
    "notes" TEXT,

    CONSTRAINT "trading_calendar_pkey" PRIMARY KEY ("date")
);

-- CreateTable
CREATE TABLE "user_alerts" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER,
    "symbol" TEXT,
    "alert_type" TEXT NOT NULL,
    "condition" TEXT NOT NULL,
    "threshold" DECIMAL(12,2),
    "is_active" BOOLEAN DEFAULT true,
    "triggered_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_subscribers" (
    "id" SERIAL NOT NULL,
    "chat_id" TEXT NOT NULL,
    "username" TEXT,
    "email" TEXT NOT NULL,
    "subscribed_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "is_active" BOOLEAN DEFAULT true,
    "user_id" INTEGER,
    "is_verified" BOOLEAN DEFAULT false,
    "verification_token" TEXT,
    "preferences" JSONB DEFAULT '{}',

    CONSTRAINT "user_subscribers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_suggestions" (
    "id" SERIAL NOT NULL,
    "username" TEXT,
    "message" TEXT NOT NULL,
    "source" TEXT,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_suggestions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_watchlists" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER,
    "name" TEXT NOT NULL,
    "symbols" TEXT[],
    "is_default" BOOLEAN DEFAULT false,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_watchlists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "telegram_id" BIGINT,
    "email" TEXT,
    "phone" TEXT,
    "name" TEXT,
    "is_premium" BOOLEAN DEFAULT false,
    "is_active" BOOLEAN DEFAULT true,
    "settings" JSONB DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "last_active" TIMESTAMPTZ(6),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_notifications" (
    "id" SERIAL NOT NULL,
    "type" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "metadata" JSONB DEFAULT '{}',
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "system_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "api_keys_key_key" ON "api_keys"("key");

-- CreateIndex
CREATE INDEX "idx_api_keys_key" ON "api_keys"("key");

-- CreateIndex
CREATE INDEX "audit_log_time_idx" ON "audit_log"("time" DESC);

-- CreateIndex
CREATE INDEX "idx_backfill_jobs_status" ON "backfill_jobs"("status");

-- CreateIndex
CREATE INDEX "candles_1m_time_idx" ON "candles_1m"("time" DESC);

-- CreateIndex
CREATE INDEX "idx_candles_1m_symbol_time" ON "candles_1m"("symbol", "time" DESC);

-- CreateIndex
CREATE INDEX "idx_data_availability_symbol" ON "data_availability"("symbol");

-- CreateIndex
CREATE UNIQUE INDEX "data_availability_symbol_timeframe_key" ON "data_availability"("symbol", "timeframe");

-- CreateIndex
CREATE UNIQUE INDEX "instruments_symbol_key" ON "instruments"("symbol");

-- CreateIndex
CREATE INDEX "idx_instruments_sector" ON "instruments"("sector_id");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_invoice_number_key" ON "invoices"("invoice_number");

-- CreateIndex
CREATE INDEX "idx_invoices_user" ON "invoices"("user_id");

-- CreateIndex
CREATE INDEX "market_breadth_time_idx" ON "market_breadth"("time" DESC);

-- CreateIndex
CREATE INDEX "idx_options_symbol_expiry" ON "options_chain"("symbol", "expiry", "strike", "option_type", "time" DESC);

-- CreateIndex
CREATE INDEX "options_chain_time_idx" ON "options_chain"("time" DESC);

-- CreateIndex
CREATE INDEX "idx_payments_status" ON "payments"("status");

-- CreateIndex
CREATE INDEX "idx_payments_user" ON "payments"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "plans_name_key" ON "plans"("name");

-- CreateIndex
CREATE INDEX "sector_strength_time_idx" ON "sector_strength"("time" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "sectors_name_key" ON "sectors"("name");

-- CreateIndex
CREATE INDEX "signals_time_idx" ON "signals"("time" DESC);

-- CreateIndex
CREATE INDEX "idx_subscriptions_status" ON "subscriptions"("status");

-- CreateIndex
CREATE INDEX "idx_subscriptions_user" ON "subscriptions"("user_id");

-- CreateIndex
CREATE INDEX "idx_tech_indicators_symbol_tf" ON "technical_indicators"("symbol", "timeframe", "time" DESC);

-- CreateIndex
CREATE INDEX "technical_indicators_time_idx" ON "technical_indicators"("time" DESC);

-- CreateIndex
CREATE INDEX "idx_user_alerts_symbol" ON "user_alerts"("symbol");

-- CreateIndex
CREATE INDEX "idx_user_alerts_user" ON "user_alerts"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_subscribers_chat_id_key" ON "user_subscribers"("chat_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_subscribers_email_key" ON "user_subscribers"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_telegram_id_key" ON "users"("telegram_id");

-- CreateIndex
CREATE INDEX "idx_users_email" ON "users"("email");

-- CreateIndex
CREATE INDEX "idx_users_telegram" ON "users"("telegram_id");

-- CreateIndex
CREATE INDEX "system_notifications_created_at_idx" ON "system_notifications"("created_at" DESC);

-- CreateIndex
CREATE INDEX "system_notifications_is_read_idx" ON "system_notifications"("is_read");

-- AddForeignKey
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "instruments" ADD CONSTRAINT "instruments_sector_id_fkey" FOREIGN KEY ("sector_id") REFERENCES "sectors"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "user_alerts" ADD CONSTRAINT "user_alerts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "user_subscribers" ADD CONSTRAINT "user_subscribers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "user_watchlists" ADD CONSTRAINT "user_watchlists_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
