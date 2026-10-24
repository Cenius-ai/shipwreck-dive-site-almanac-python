"""Internal links (and the links JavaScript builds) must resolve."""

import json
import re
import unittest
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA_PATH = ROOT / "data.json"

PAGE_LINK_PATTERN = re.compile(r"""(?:href|src)=["']([^"']+)["']""")
JS_PAGE_PATTERN = re.compile(r"""["'](\./[A-Za-z0-9_\-/]+\.html)(?:\?[^"']*)?["']""")
H1_PATTERN = re.compile(r"<h1\b", re.IGNORECASE)


class LinkCollector(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.links = []
        self.ids = set()

    def handle_starttag(self, tag, attrs):
        attributes = dict(attrs)
        if "href" in attributes and attributes["href"]:
            self.links.append((tag, attributes["href"]))
        if "id" in attributes and attributes["id"]:
            self.ids.add(attributes["id"])


def parse_page(path):
    collector = LinkCollector()
    collector.feed(path.read_text(encoding="utf-8"))
    return collector


def seeded_site_ids():
    with DATA_PATH.open(encoding="utf-8") as handle:
        return {site["id"] for site in json.load(handle)["sites"]}


class LinkResolutionTests(unittest.TestCase):
    def setUp(self):
        self.pages = sorted(ROOT.glob("*.html"))
        self.site_ids = seeded_site_ids()

    def test_every_html_file_exists_for_the_pages_we_ship(self):
        names = {page.name for page in self.pages}
        for expected in ("index.html", "wreck.html", "briefing.html", "signin.html", "log.html"):
            self.assertIn(expected, names)

    def test_internal_page_links_resolve(self):
        for page in self.pages:
            for tag, href in parse_page(page).links:
                if href.startswith(("http://", "https://", "//", "mailto:", "tel:", "data:")):
                    continue
                target = href.split("#")[0].split("?")[0]
                if not target:
                    continue
                resolved = (page.parent / target).resolve()
                self.assertTrue(
                    resolved.exists(),
                    "%s links to %s via <%s> but that file is missing" % (page.name, href, tag),
                )

    def test_per_site_links_use_seeded_site_ids(self):
        for page in self.pages:
            for _tag, href in parse_page(page).links:
                if "?id=" not in href:
                    continue
                site_id = href.split("?id=", 1)[1].split("&")[0].split("#")[0]
                self.assertIn(
                    site_id,
                    self.site_ids,
                    "%s links to site id %r which is not in data.json" % (page.name, site_id),
                )

    def test_fragment_links_point_at_an_element_on_the_page(self):
        for page in self.pages:
            collector = parse_page(page)
            for _tag, href in collector.links:
                if not href.startswith("#") or href == "#":
                    continue
                self.assertIn(
                    href[1:],
                    collector.ids,
                    "%s links to %s but no element carries that id" % (page.name, href),
                )

    def test_every_page_carries_the_shared_navigation(self):
        for page in self.pages:
            markup = page.read_text(encoding="utf-8")
            self.assertIn('href="./index.html"', markup, "%s needs a catalog link" % page.name)
            self.assertIn('href="./log.html"', markup, "%s needs a dive log link" % page.name)
            self.assertIn('class="skip-link"', markup, "%s needs a skip link" % page.name)
            self.assertIn('id="main"', markup, "%s needs a main landmark" % page.name)
            self.assertIn('lang="en"', markup, "%s needs a language attribute" % page.name)
            self.assertIn('name="viewport"', markup, "%s needs a responsive viewport" % page.name)
            self.assertEqual(len(H1_PATTERN.findall(markup)), 1, "%s needs exactly one h1" % page.name)

    def test_the_log_and_signin_pages_link_to_each_other(self):
        signin = (ROOT / "signin.html").read_text(encoding="utf-8")
        log_page = (ROOT / "log.html").read_text(encoding="utf-8")
        self.assertIn("./log.html", signin, "the sign-in card must lead on to the log")
        self.assertIn("./signin.html", log_page, "the log page must offer the sign-in route")
        self.assertIn("cenius@cenius.ai / cenius", signin, "the demo credential is printed on the card")

    def test_javascript_built_links_target_real_files(self):
        for script in sorted(ROOT.glob("assets/js/*.js")):
            text = script.read_text(encoding="utf-8")
            for match in JS_PAGE_PATTERN.finditer(text):
                target = (ROOT / match.group(1)[2:]).resolve()
                self.assertTrue(
                    target.is_file(),
                    "%s builds a link to %s but that file is missing" % (script.name, match.group(1)),
                )

    def test_javascript_page_link_templates_carry_the_site_id(self):
        app = (ROOT / "assets/js/app.js").read_text(encoding="utf-8")
        for expected in ("./wreck.html?id=", "./briefing.html?id=", "./log.html"):
            self.assertIn(expected, app, "app.js should build %s links" % expected)

    def test_catalog_page_offers_a_route_into_every_section(self):
        catalog = (ROOT / "index.html").read_text(encoding="utf-8")
        for target in ("./wreck.html?id=", "./briefing.html?id=", "./log.html", "./signin.html"):
            self.assertIn(target, catalog, "the catalog should reach %s" % target)

    def test_pages_do_not_use_inline_event_handlers(self):
        for page in self.pages:
            markup = page.read_text(encoding="utf-8")
            self.assertNotRegex(markup, r"\son[a-z]+\s*=", "%s uses an inline event handler" % page.name)
            self.assertNotRegex(markup, r"<script(?![^>]*\bsrc=)[^>]*>", "%s uses an inline script" % page.name)


if __name__ == "__main__":
    unittest.main()
