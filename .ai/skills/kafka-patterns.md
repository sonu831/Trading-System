# Skill: Kafka Event Patterns

> **For adding or modifying Kafka producers and consumers.** Every layer that
> touches Kafka must follow these patterns.

## ⚠️ Use shared/ Constants — Never Hardcode

```js
const { KAFKA_TOPICS, KAFKA_GROUPS } = require('/app/shared/constants');
const TOPIC = KAFKA_TOPICS.TRADE_SIGNALS; // not 'trade-signals'
const GROUP_ID = KAFKA_GROUPS.L2_PROCESSING; // not 'layer-2-processing-group-v4'
```

All 11 Kafka topics and 7 consumer groups are defined once in `shared/constants.js`. See `shared/README.md`.

## Producer Pattern

```typescript
// Node.js (kafkajs)
const producer = kafka.producer({
  maxInFlightRequests: 1,
  idempotent: true,
});

await producer.connect();

const sendMessage = async (topic: string, messages: KafkaMessage[]) => {
  await producer.send({
    topic,
    messages: messages.map(m => ({
      key: m.key,           // Partition key (symbol name)
      value: JSON.stringify(m.value),
      headers: {
        source: 'layer-N',
        version: '1.0',
        timestamp: String(Date.now()),
      },
    })),
  });
};
```

```go
// Go (sarama)
config := sarama.NewConfig()
config.Producer.RequiredAcks = sarama.WaitForLocal
config.Producer.Idempotent = true
config.Producer.Return.Successes = true

producer, _ := sarama.NewSyncProducer(brokers, config)

msg := &sarama.ProducerMessage{
    Topic: topic,
    Key:   sarama.StringEncoder(symbol),
    Value: sarama.ByteEncoder(jsonData),
    Headers: []sarama.RecordHeader{
        {Key: []byte("source"), Value: []byte("layer-4")},
    },
}
partition, offset, _ := producer.SendMessage(msg)
```

## Consumer Pattern (Idempotent)

```typescript
// Node.js
const consumer = kafka.consumer({
  groupId: 'service-name-v1',
  sessionTimeout: 30000,
});

await consumer.subscribe({ topic: 'market_candles', fromBeginning: false });

await consumer.run({
  autoCommit: false,  // Manual commit after processing
  eachMessage: async ({ topic, partition, message }) => {
    const data = JSON.parse(message.value.toString());
    
    // IDEMPOTENCY: Use upsert/ON CONFLICT DO NOTHING
    await db.query(`
      INSERT INTO candles (...) VALUES (...)
      ON CONFLICT (symbol, timeframe, timestamp) DO NOTHING
    `);
    
    // Commit offset only after successful processing
    await consumer.commitOffsets([{
      topic, partition,
      offset: (Number(message.offset) + 1).toString()
    }]);
  },
});
```

## Topic Naming Convention

| Rule | Example |
|------|---------|
| Lowercase, snake_case | `raw_ticks`, `market_candles` |
| Singular noun | `market_candle` (not `market_candles`) |
| Descriptive | `analysis_updates` (not `topic_3_data`) |
| Versioned if breaking | `trade_signals_v2` |

## Message Schema Convention

Every Kafka message must have:
```typescript
interface KafkaMessage<T> {
  // HEADER (not in body -- use Kafka headers)
  // - source: string       // Which layer produced this
  // - version: string      // Schema version
  // - timestamp: string    // Unix ms
  
  // BODY
  // The actual data payload matching shared/ schema
}
```

## Rules

1. **Consumers MUST be idempotent** -- handle duplicate messages gracefully
2. **Use manual commits** -- commit after processing, not before
3. **Group IDs include version** -- `service-v1`, `service-v2` for rolling upgrades
4. **Always set message key** -- ensures ordering per symbol
5. **Headers include source layer and version** -- traceability
6. **Never use auto.topic.create in production** -- topics must be explicitly created
