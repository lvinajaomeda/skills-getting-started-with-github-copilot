import sys
from pathlib import Path
from copy import deepcopy

# Ensure src is importable without a package
SRC_DIR = Path(__file__).resolve().parents[1] / "src"
if str(SRC_DIR) not in sys.path:
    sys.path.insert(0, str(SRC_DIR))

from fastapi.testclient import TestClient  # type: ignore
from app import app, activities  # type: ignore

import pytest


@pytest.fixture()
def client():
    # Snapshot the activities state and restore after each test
    snapshot = deepcopy(activities)
    yield TestClient(app)
    activities.clear()
    activities.update(snapshot)


def test_root_redirect(client):
    resp = client.get("/", follow_redirects=False)
    assert resp.status_code in (302, 307)
    assert resp.headers.get("location") == "/static/index.html"


def test_get_activities_structure(client):
    resp = client.get("/activities")
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, dict)
    assert "Chess Club" in data
    assert isinstance(data["Chess Club"]["participants"], list)


def test_signup_success_and_duplicate(client):
    activity = "Chess Club"
    email = "newstudent@mergington.edu"

    # Successful signup
    resp = client.post(f"/activities/{activity}/signup", params={"email": email})
    assert resp.status_code == 200
    assert "Signed up" in resp.json().get("message", "")

    # Verify participant added
    data = client.get("/activities").json()
    assert email in data[activity]["participants"]

    # Duplicate signup should fail
    resp_dup = client.post(f"/activities/{activity}/signup", params={"email": email})
    assert resp_dup.status_code == 400
    assert resp_dup.json().get("detail") == "Student already signed up for this activity"


def test_signup_unknown_activity_404(client):
    resp = client.post("/activities/Unknown Activity/signup", params={"email": "x@y.com"})
    assert resp.status_code == 404
    assert resp.json().get("detail") == "Activity not found"


def test_unregister_success_and_missing(client):
    activity = "Chess Club"
    existing_email = activities[activity]["participants"][0]

    # Successful unregister
    resp = client.post(f"/activities/{activity}/unregister", params={"email": existing_email})
    assert resp.status_code == 200
    assert "Unregistered" in resp.json().get("message", "")

    # Verify participant removed
    data = client.get("/activities").json()
    assert existing_email not in data[activity]["participants"]

    # Unregister again should fail
    resp_missing = client.post(f"/activities/{activity}/unregister", params={"email": existing_email})
    assert resp_missing.status_code == 400
    assert resp_missing.json().get("detail") == "Student is not registered for this activity"


def test_unregister_unknown_activity_404(client):
    resp = client.post("/activities/Unknown Activity/unregister", params={"email": "x@y.com"})
    assert resp.status_code == 404
    assert resp.json().get("detail") == "Activity not found"
