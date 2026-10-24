"""Contract checks for data.json: the single static dataset every page reads."""

import json
import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA_PATH = ROOT / "data.json"

REQUIRED_SITE_FIELDS = [
    "id",
    "name",
    "region",
    "country",
    "vesselType",
    "builtYear",
    "lengthM",
    "sankYear",
    "sankDate",
    "sinkingCause",
    "sinkingHistory",
    "seabedDepthM",
    "deckDepthM",
    "shallowestDepthM",
    "certificationRequired",
    "hazards",
    "entryExit",
    "boatTraffic",
    "emergencyPlan",
    "slackAnchor",
    "slackOffsetMin",
    "slackWindowMinutes",
]

ANCHOR_FIELDS = {
    "high": "highWater",
    "low": "lowWater",
    "high2": "secondaryHighWater",
    "low2": "secondaryLowWater",
}

TIME_PATTERN = re.compile(r"^([01]?\d|2[0-3]):([0-5]\d)$")
SLUG_PATTERN = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
DATE_PATTERN = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def load_data():
    with DATA_PATH.open(encoding="utf-8") as handle:
        return json.load(handle)


def minutes_of(value):
    """HH:MM -> minutes past midnight, or None when the value is not a time."""
    if not isinstance(value, str):
        return None
    match = TIME_PATTERN.match(value.strip())
    if not match:
        return None
    return int(match.group(1)) * 60 + int(match.group(2))


class DataFileTests(unittest.TestCase):
    def setUp(self):
        self.data = load_data()

    def test_data_file_is_valid_json_and_small(self):
        self.assertTrue(DATA_PATH.is_file(), "data.json must sit at the repository root")
        self.assertLess(DATA_PATH.stat().st_size, 100 * 1024, "data.json must stay under 100 KB")

    def test_schema_version_and_root_keys(self):
        self.assertEqual(self.data.get("schemaVersion"), 1)
        self.assertIsInstance(self.data.get("sites"), list)
        self.assertIsInstance(self.data.get("checklist"), list)
        self.assertIsInstance(self.data.get("tideReference"), dict)

    def test_tide_reference_publishes_four_valid_anchor_times(self):
        reference = self.data["tideReference"]
        self.assertTrue(reference.get("label"), "the tide reference needs a label")
        for key in ANCHOR_FIELDS.values():
            self.assertIsNotNone(
                minutes_of(reference.get(key)),
                "tideReference.%s must be a HH:MM 24 hour time" % key,
            )

    def test_six_or_more_sites_publish_every_required_field(self):
        sites = self.data["sites"]
        self.assertGreaterEqual(len(sites), 6, "the almanac seeds at least six wrecks")
        for site in sites:
            for field in REQUIRED_SITE_FIELDS:
                self.assertIn(field, site, "site %r is missing %r" % (site.get("id"), field))

    def test_site_ids_are_unique_slugs(self):
        ids = [site["id"] for site in self.data["sites"]]
        self.assertEqual(len(ids), len(set(ids)), "site ids must be unique")
        for site_id in ids:
            self.assertRegex(site_id, SLUG_PATTERN, "site ids are used in URLs as slugs")

    def test_depths_are_numbers_and_ordered(self):
        for site in self.data["sites"]:
            seabed = site["seabedDepthM"]
            deck = site["deckDepthM"]
            shallowest = site["shallowestDepthM"]
            for name, value in (
                ("seabedDepthM", seabed),
                ("deckDepthM", deck),
                ("shallowestDepthM", shallowest),
            ):
                self.assertIsInstance(value, (int, float), "%s on %s must be a number" % (name, site["id"]))
                self.assertGreaterEqual(value, 0, "%s on %s cannot be negative" % (name, site["id"]))
            self.assertLessEqual(shallowest, deck, "shallowest depth on %s must be above the deck" % site["id"])
            self.assertLessEqual(deck, seabed, "deck depth on %s must be above the seabed" % site["id"])

    def test_sinking_history_is_published(self):
        for site in self.data["sites"]:
            self.assertRegex(site["sankDate"], DATE_PATTERN, "%s needs a YYYY-MM-DD sank date" % site["id"])
            self.assertEqual(
                str(site["sankYear"]),
                site["sankDate"][:4],
                "%s sankYear must agree with its sankDate" % site["id"],
            )
            self.assertGreaterEqual(len(site["sinkingHistory"].split()), 25, "narrative accounts carry real copy")

    def test_slack_fields_are_valid(self):
        for site in self.data["sites"]:
            self.assertIn(site["slackAnchor"], ANCHOR_FIELDS, "%s needs a known slack anchor" % site["id"])
            self.assertIsInstance(site["slackOffsetMin"], int, "%s offset must be whole minutes" % site["id"])
            self.assertIsInstance(site["slackWindowMinutes"], int, "%s window must be whole minutes" % site["id"])
            self.assertGreaterEqual(site["slackWindowMinutes"], 10, "%s window is unrealistically short" % site["id"])
            self.assertLessEqual(site["slackWindowMinutes"], 120, "%s window is unrealistically long" % site["id"])

    def test_slack_window_maths_stays_inside_a_day(self):
        reference = self.data["tideReference"]
        for site in self.data["sites"]:
            anchor_minutes = minutes_of(reference[ANCHOR_FIELDS[site["slackAnchor"]]])
            start = (anchor_minutes + site["slackOffsetMin"]) % 1440
            end = (start + site["slackWindowMinutes"]) % 1440
            self.assertGreaterEqual(start, 0)
            self.assertLess(start, 1440)
            self.assertGreaterEqual(end, 0)
            self.assertLess(end, 1440)
            self.assertEqual(end, (start + site["slackWindowMinutes"]) % 1440)

    def test_briefing_copy_is_published_for_every_site(self):
        for site in self.data["sites"]:
            self.assertIsInstance(site["hazards"], list)
            self.assertGreaterEqual(len(site["hazards"]), 1, "%s needs at least one hazard" % site["id"])
            for hazard in site["hazards"]:
                self.assertTrue(str(hazard).strip(), "%s has an empty hazard" % site["id"])
            for field in ("entryExit", "boatTraffic", "emergencyPlan"):
                self.assertGreaterEqual(
                    len(str(site[field]).strip()), 20, "%s.%s needs real briefing copy" % (site["id"], field)
                )

    def test_checklist_items_have_unique_order_and_text(self):
        checklist = self.data["checklist"]
        self.assertGreaterEqual(len(checklist), 6, "the pre-dive checklist seeds at least six rows")
        ids = set()
        orders = set()
        for item in checklist:
            self.assertIsInstance(item.get("id"), str)
            self.assertNotIn(item["id"], ids, "checklist ids must be unique")
            ids.add(item["id"])
            self.assertIsInstance(item.get("text"), str)
            self.assertGreaterEqual(len(item["text"].strip()), 10, "checklist rows carry real briefing copy")
            self.assertIsInstance(item.get("order"), int)
            self.assertNotIn(item["order"], orders, "checklist order values must be unique")
            orders.add(item["order"])


if __name__ == "__main__":
    unittest.main()
