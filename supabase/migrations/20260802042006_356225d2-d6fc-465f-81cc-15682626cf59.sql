-- Stop high-frequency background jobs that generate constant PostgREST traffic
select cron.unschedule(1);   -- backfill-product-descriptions every 5 min
select cron.unschedule(21);  -- cache-warm every 30 min (writes cache_metrics)

-- Hourly -> daily
select cron.alter_job(3,  schedule => '0 2 * * *');   -- generate-recommendations
select cron.alter_job(7,  schedule => '0 4 * * *');   -- compute-weekly-popular
select cron.alter_job(14, schedule => '15 8 * * *');  -- engagement-jobs trending-product
select cron.alter_job(15, schedule => '30 8 * * *');  -- engagement-jobs back-in-stock