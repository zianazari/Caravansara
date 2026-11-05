"""The dashboard and the alert rules only use metrics the code really exports.

A renamed metric would otherwise leave a panel empty and an alert silent, with no error anywhere.
"""

import json
import re
from pathlib import Path

from prometheus_client import REGISTRY

import caravansara.core.metrics  # noqa: F401 (registers the metrics)

OBSERVABILITY = Path(__file__).resolve().parents[2] / "observability"
DASHBOARDS = sorted((OBSERVABILITY / "grafana" / "dashboards").glob("*.json"))
ALERTS = OBSERVABILITY / "prometheus" / "alerts.yml"
DATASOURCES = OBSERVABILITY / "grafana" / "provisioning" / "datasources" / "datasources.yml"
_SUFFIXES = re.compile(r"_(total|bucket|count|sum|created)$")


def exported() -> set[str]:
    return {family.name for family in REGISTRY.collect() if family.name.startswith("caravansara_")}


def used_in(text: str) -> set[str]:
    return {_SUFFIXES.sub("", name) for name in re.findall(r"\bcaravansara_[a-z_]+", text)}


def expressions(panel: dict) -> list[str]:  # type: ignore[type-arg]
    return [t["expr"] for t in panel.get("targets", [])]


def test_dashboards_and_alerts_use_only_exported_metrics() -> None:
    assert DASHBOARDS
    for path in [*DASHBOARDS, ALERTS]:
        used = used_in(path.read_text(encoding="utf-8"))
        assert used, path
        assert used <= exported(), f"{path.name} uses unknown metrics: {sorted(used - exported())}"


def test_every_business_metric_is_on_the_dashboard() -> None:
    text = "".join(p.read_text(encoding="utf-8") for p in DASHBOARDS)
    assert exported() <= used_in(text), f"not shown anywhere: {sorted(exported() - used_in(text))}"


def test_dashboard_panels_point_at_provisioned_datasources() -> None:
    provisioned = set(re.findall(r"^\s+uid: (\w+)", DATASOURCES.read_text(encoding="utf-8"), re.MULTILINE))
    assert provisioned == {"prometheus", "loki", "tempo"}
    for path in DASHBOARDS:
        dashboard = json.loads(path.read_text(encoding="utf-8"))
        ids = [p["id"] for p in dashboard["panels"]]
        assert len(ids) == len(set(ids)), f"{path.name}: duplicate panel ids"
        for panel in dashboard["panels"]:
            if panel["type"] != "row":
                assert panel["datasource"]["uid"] in provisioned, panel["title"]
                assert expressions(panel), panel["title"]
