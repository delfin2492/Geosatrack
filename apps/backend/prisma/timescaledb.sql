-- Convert the Telemetry table to a TimescaleDB Hypertable partitioned by the timestamp column,
-- migrating any existing records (seeded data) automatically.
SELECT create_hypertable('"Telemetry"', 'timestamp', migrate_data => true);
