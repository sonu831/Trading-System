-- CreateIndex
CREATE UNIQUE INDEX "unique_candle_per_minute" ON "candles_1m"("symbol", "time");
