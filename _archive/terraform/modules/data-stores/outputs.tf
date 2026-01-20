output "rds_endpoint" {
  value = aws_db_instance.postgres.endpoint
}

output "redis_endpoint" {
  value = aws_elasticache_replication_group.redis.primary_endpoint_address
}

output "kafka_brokers" {
  value = aws_msk_cluster.kafka.bootstrap_brokers
}
