const { createContainer, asClass, asValue, asFunction, Lifetime } = require('awilix');
const { PrismaClient } = require('@prisma/client');
const redis = require('./redis/client');

// Import Base Classes (for reference/extension)
const BaseRepository = require('./common/repositories/BaseRepository');

// Import Application Classes (Will be auto-loaded pattern later, but manual for now)
// Data Availability Feature
const DataRepository = require('./modules/data/DataRepository');
const DataService = require('./modules/data/DataService');
const DataController = require('./modules/data/DataController');

// Initialize Singletons
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.TIMESCALE_URL || process.env.DATABASE_URL,
    },
  },
});
// Redis client is already initialized in its module

// Configure Container
const container = createContainer();

container.register({
  // 1. External dependencies
  prisma: asValue(prisma),
  redis: asValue(redis),

  // 2. Base Classes
  baseRepo: asClass(BaseRepository),

  // 3. Application Components (Repositories -> Services -> Controllers)
  // Data Availability
  dataRepository: asClass(DataRepository).singleton(),
  dataService: asClass(DataService).singleton(),
  dataController: asClass(DataController).singleton(),

  // Signals
  signalRepository: asClass(require('./modules/signals/SignalRepository')).singleton(),
  signalService: asClass(require('./modules/signals/SignalService')).singleton(),
  signalController: asClass(require('./modules/signals/SignalController')).singleton(),

  // System (Status & Backfill)
  systemRepository: asClass(require('./modules/system/SystemRepository')).singleton(),
  systemService: asClass(require('./modules/system/SystemService')).singleton(),
  systemController: asClass(require('./modules/system/SystemController')).singleton(),

  // Market (View & Data)
  marketRepository: asClass(require('./modules/market/MarketRepository')).singleton(),
  marketService: asClass(require('./modules/market/MarketService')).singleton(),
  marketController: asClass(require('./modules/market/MarketController')).singleton(),

  // Analysis (Proxy to Layer 4)
  analysisService: asClass(require('./modules/analysis/AnalysisService')).singleton(),
  analysisController: asClass(require('./modules/analysis/AnalysisController')).singleton(),
});

module.exports = container;
