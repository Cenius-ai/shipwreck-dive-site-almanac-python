"""Slack water maths, mirrored from assets/js/slack.js.

The browser computes each site's window from the static tide reference:
start = anchor time + site offset, end = start + site window, both wrapped
into a 24 hour clock. These tests pin that contract down independently of
the browser, including the cases the UI has to survive.
"""

import json
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA_PATH = ROOT / "data.json"

ANCHOR_FIELDS = {
    "high": "highWater",
    "low": "lowWater",
    "high2": "secondaryHighWater",
    "low2": "secondaryLowWater",
}


def parse_hhmm(value):
    if not isinstance(value, str):
        return None
    pieces = value.strip().split(":")
    if len(pieces) != 2 or not all(piece.isdigit() for piece in pieces):
        return None
    hours, minutes = int(pieces[0]), int(pieces[1])
    if hours > 23 or minutes > 59:
        return None
    return hours * 60 + minutes


def format_minutes(total):
    wrapped = total % 1440
    return "%02d:%02d" % (wrapped // 60, wrapped % 60)


def compute_window(reference, anchor_key, offset_minutes, window_minutes):
    """Returns (start, end) as HH:MM strings, or None when the row is invalid."""
    field = ANCHOR_FIELDS.get(anchor_key)
    if field is None:
        return None
    anchor = parse_hhmm(reference.get(field))
    if anchor is None:
        return None
    if not isinstance(offset_minutes, int) or isinstance(offset_minutes, bool):
        return None
    if not isinstance(window_minutes, int) or isinstance(window_minutes, bool) or window_minutes <= 0:
        return None
    start = (anchor + offset_minutes) % 1440
    end = (start + window_minutes) % 1440
    return format_minutes(start), format_minutes(end)


class SlackWindowTests(unittest.TestCase):
    reference = {
        "highWater": "09:12",
        "lowWater": "15:36",
        "secondaryHighWater": "21:40",
        "secondaryLowWater": "03:48",
    }

    def test_high_water_minus_forty_five_minutes(self):
        self.assertEqual(
            compute_window(self.reference, "high", -45, 30),
            ("08:27", "08:57"),
            "09:12 minus 45 minutes is 08:27, plus 30 minutes of slack is 08:57",
        )

    def test_window_wraps_past_midnight(self):
        self.assertEqual(compute_window(self.reference, "high2", 120, 45), ("23:40", "00:25"))

    def test_negative_offset_wraps_backwards_before_midnight(self):
        self.assertEqual(compute_window(self.reference, "high", -600, 30), ("23:12", "23:42"))

    def test_window_length_is_validated(self):
        self.assertIsNone(compute_window(self.reference, "high", 0, 0))
        self.assertIsNone(compute_window(self.reference, "high", 0, -30))
        self.assertIsNone(compute_window(self.reference, "high", 0, None))

    def test_offset_must_be_whole_minutes(self):
        self.assertIsNone(compute_window(self.reference, "high", None, 30))
        self.assertIsNone(compute_window(self.reference, "high", 12.5, 30))

    def test_unknown_anchor_is_rejected(self):
        self.assertIsNone(compute_window(self.reference, "springs", 0, 30))
        self.assertIsNone(compute_window({}, "high", 0, 30))

    def test_every_seeded_site_has_a_computable_window(self):
        with DATA_PATH.open(encoding="utf-8") as handle:
            data = json.load(handle)
        reference = data["tideReference"]
        for site in data["sites"]:
            window = compute_window(
                reference,
                site["slackAnchor"],
                site["slackOffsetMin"],
                site["slackWindowMinutes"],
            )
            self.assertIsNotNone(window, "%s should publish a slack window" % site["id"])
            start, end = window
            self.assertRegex(start, r"^\d{2}:\d{2}$")
            self.assertRegex(end, r"^\d{2}:\d{2}$")


if __name__ == "__main__":
    unittest.main()
