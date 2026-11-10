"""Prometheus metrics: HTTP (rate, errors, duration), business events and the worker.

Labels hold only small fixed sets: the route *template* (``/listings/{listing_id}``), never the
real path, because every distinct label value becomes its own time series in Prometheus.
Each process (API copy, worker) counts on its own; Prometheus adds them up.
"""

from prometheus_client import Counter, Gauge, Histogram

HTTP_REQUESTS = Counter(
    "caravansara_http_requests_total",
    "HTTP requests by method, route template and status code.",
    ["method", "route", "status"],
)
HTTP_DURATION = Histogram(
    "caravansara_http_request_duration_seconds",
    "Time to answer an HTTP request.",
    ["method", "route"],
    buckets=(0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10),
)

BOOKING_EVENTS_LIST = ("created", "confirmed", "cancelled", "expired", "completed")
BOOKING_EVENTS = Counter(
    "caravansara_booking_events_total",
    "Booking lifecycle events: created (hold), confirmed (paid), cancelled, expired, completed.",
    ["event"],
)
BOOKING_CONFLICTS = Counter(
    "caravansara_booking_conflicts_total",
    "Reservations stopped by the no_double_booking constraint (SQLSTATE 23P01).",
)
RATE_LIMITED = Counter(
    "caravansara_rate_limited_total",
    "Login or registration attempts refused by the rate limit.",
    ["action"],
)
REVIEWS = Counter("caravansara_reviews_total", "Reviews written.")

# Listing review (specs/backend (004), FR-016). "submitted" counts every entry to the queue:
# a new listing, a resubmission and a descriptive edit of an approved listing.
LISTING_REVIEW_EVENTS_LIST = ("submitted", "approved", "rejected")
LISTING_REVIEW_EVENTS = Counter(
    "caravansara_listing_review_events_total",
    "Listing review events: submitted (entered the queue), approved, rejected.",
    ["event"],
)
# Only the worker sets these two, once a run (research R10). Each API copy would otherwise report
# its own stale number, and Prometheus would add them up.
EMAIL_KINDS = ("listing_approved", "listing_rejected", "booking_confirmed_guest", "booking_confirmed_host")
EMAIL_RESULTS = ("sent", "retry", "failed")
EMAILS = Counter(
    "caravansara_emails_total",
    "Outbox emails by kind and result: sent, retry (will try again) or failed (given up) (feature 013).",
    ["kind", "result"],
)
EMAIL_OUTBOX_QUEUE = Gauge("caravansara_email_outbox_queue", "Emails waiting in the outbox to be sent.")
EMAIL_OUTBOX_OLDEST_WAIT = Gauge(
    "caravansara_email_outbox_oldest_wait_seconds",
    "How long the oldest unsent email has waited; 0 when the outbox is empty.",
)
LISTING_REVIEW_QUEUE = Gauge("caravansara_listing_review_queue", "Listings waiting for an admin's review.")
LISTING_REVIEW_OLDEST_WAIT = Gauge(
    "caravansara_listing_review_oldest_wait_seconds",
    "How long the oldest listing in the review queue has waited; 0 when the queue is empty.",
)

WORKER_RUNS = Counter("caravansara_worker_runs_total", "Worker job runs by result.", ["result"])
WORKER_LAST_SUCCESS = Gauge(
    "caravansara_worker_last_success_timestamp_seconds",
    "Unix time of the last successful worker run. If it stops moving, holds stay locked.",
)
WORKER_DURATION = Histogram(
    "caravansara_worker_run_duration_seconds",
    "Time one worker run takes.",
    buckets=(0.01, 0.05, 0.1, 0.5, 1, 5, 10, 30),
)

# Series exist from the start at 0, so rate() and alerts work before the first event.
for _event in BOOKING_EVENTS_LIST:
    BOOKING_EVENTS.labels(_event)
for _kind in EMAIL_KINDS:
    for _email_result in EMAIL_RESULTS:
        EMAILS.labels(_kind, _email_result)
for _event in LISTING_REVIEW_EVENTS_LIST:
    LISTING_REVIEW_EVENTS.labels(_event)
for _action in ("login", "register", "admin_login"):
    RATE_LIMITED.labels(_action)
for _result in ("ok", "error"):
    WORKER_RUNS.labels(_result)
