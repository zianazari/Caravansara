"""The committed openapi.json is the API contract: any change to it must be deliberate."""

from pathlib import Path

from caravansara import cli


def test_openapi_json_matches_the_code() -> None:
    committed = cli.OPENAPI_FILE.read_text(encoding="utf-8") if cli.OPENAPI_FILE.exists() else ""
    assert committed == cli.openapi_document(), (
        "The API changed but backend/openapi.json did not. If the change is intended, run "
        "`uv run caravansara export-openapi` and commit openapi.json, so the frontend sees it."
    )


def test_export_openapi_writes_the_contract(tmp_path: Path) -> None:
    target = tmp_path / "openapi.json"
    cli.main(["export-openapi", "--output", str(target)])
    assert target.read_text(encoding="utf-8") == cli.openapi_document()
