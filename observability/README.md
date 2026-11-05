# Monitoring

Logs, metrics and traces for Caravansara. Everything runs as a `docker compose` profile, so
daily development stays light and the full stack starts with one command:

```bash
docker compose --profile observability up -d --build
```

| URL | What |
| --- | --- |
| http://localhost:3000 | Grafana (`admin` / `caravansara`, or `GRAFANA_ADMIN_PASSWORD`). The **Caravansara** dashboard opens first |
| http://localhost:9090 | Prometheus: targets, alert rules and their state |

## How the pieces fit

```
api, worker ──/metrics──────────────▶ Prometheus ──▶ alerts.yml
postgres-exporter, minio ──metrics──▶ Prometheus
every container ──stdout──▶ Alloy ──▶ Loki
api, worker ──OTLP traces──▶ Alloy ──▶ Tempo
                Grafana reads Prometheus, Loki and Tempo
```

| Folder | Service | Why this one |
| --- | --- | --- |
| `alloy/` | Grafana Alloy | One collector for logs (from Docker) and traces (OTLP). Promtail is end of life |
| `loki/` | Loki | Stores logs. Only `service` and `level` are labels; `request_id` and `trace_id` are structured metadata, because one value per request would explode the index |
| `tempo/` | Tempo | Stores traces |
| `prometheus/` | Prometheus | Scrapes metrics, evaluates `alerts.yml`. DNS discovery finds every copy after `--scale api=3` |
| `grafana/` | Grafana | Datasources and the dashboard are provisioned from files, so every environment has the same ones and changes are reviewed in git |

Everything is open source and vendor neutral: the app speaks OpenTelemetry and the
Prometheus format, so a different backend means changing this folder, not the code.

## Following one slow request

1. A panel on the dashboard shows a slow route (**Response time p95 by route**).
2. **Explore logs**: `{service="api"} | json | route="/api/v1/search/listings" | duration_ms > 500`.
3. Open a line and press **Trace**. Tempo shows where the time went: the request, each SQL statement, each S3 call.
4. From a span, **Logs for this span** goes back to every log line of that request.

## Alerts

| Alert | Fires when | Why it matters |
| --- | --- | --- |
| `ApiDown` | no API instance answers for 1 min | the site is down |
| `WorkerDown` | no worker for 2 min, also when the container is gone | unpaid holds stay locked, stays never complete; the API shows no error |
| `WorkerStale` | the last successful worker run is older than 5 min | the worker runs but fails, e.g. no database |
| `HighErrorRate` | more than 5% of requests fail with 5xx for 5 min | |
| `SlowSearch` | search p95 above 1 s for 10 min | search is the busiest page |
| `DatabaseDown` | PostgreSQL unreachable for 1 min | |
| `DatabaseConnectionsHigh` | more than 80% of connections in use for 5 min | new requests start to wait |

The thresholds are first guesses; tune them after a few weeks of real data. Alerts show in
Prometheus and Grafana; sending them to email or chat needs Alertmanager or Grafana contact points.

## Checks

- `prometheus/alerts.test.yml`: unit tests for the alert rules (`promtool test rules`).
- `backend/tests/test_monitoring_config.py`: the dashboard and alerts only use metrics the code exports, and every app metric is on the dashboard.
- CI validates the Prometheus config, runs the rule tests and checks the Alloy config and the compose file.

## Production notes

- `/metrics` is open on the API port for Prometheus. Keep it off the public internet (internal network or a proxy rule), or set `CARAVANSARA_METRICS_ENABLED=false`.
- `MINIO_PROMETHEUS_AUTH_TYPE=public` and the Grafana password are development settings.
- Alloy reads the Docker socket to collect logs; on Kubernetes it reads pod logs instead.
- `CARAVANSARA_OTEL_SAMPLE_RATIO` keeps only a share of traces when traffic grows.
