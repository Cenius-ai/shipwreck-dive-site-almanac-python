"""Client-side routing: the router upgrades plain file links into in-app views.

Every route stays a real file on disk (so deep links and plain http.server keep
working), and assets/js/router.js intercepts internal navigation, swaps the
view, pushes history and re-runs the route's controller.
"""

import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ROUTER = ROOT / "assets" / "js" / "router.js"
PAGES = {
    "index.html": "catalog",
    "wreck.html": "wreck",
    "briefing.html": "briefing",
    "log.html": "log",
    "signin.html": "signin",
}
CONTROLLERS = {
    "index.html": "assets/js/app.js",
    "wreck.html": "assets/js/wreck.js",
    "briefing.html": "assets/js/briefing.js",
    "log.html": "assets/js/log.js",
    "signin.html": "assets/js/session.js",
}


class RouterTests(unittest.TestCase):
    def test_router_script_is_delivered(self):
        self.assertTrue(ROUTER.is_file(), "assets/js/router.js must ship")

    def test_every_page_loads_the_router_last(self):
        for page in PAGES:
            markup = (ROOT / page).read_text(encoding="utf-8")
            self.assertIn('src="./assets/js/router.js"', markup, "%s must load the router" % page)
            self.assertEqual(markup.count("router.js"), 1, "%s loads router.js once" % page)
            last_script = re.findall(r'<script src="([^"]+)"', markup)[-1]
            self.assertEqual(last_script, "./assets/js/router.js", "%s must load the router last" % page)

    def test_router_declares_every_shipped_route(self):
        source = ROUTER.read_text(encoding="utf-8")
        for page, page_name in PAGES.items():
            self.assertIn("'%s'" % page, source, "the router must know %s" % page)
            self.assertIn("page: '%s'" % page_name, source, "the router must map %s to its controller" % page)

    def test_router_uses_real_history_apis(self):
        source = ROUTER.read_text(encoding="utf-8")
        for needle in ("addEventListener('click'", "popstate", "history.pushState", "DOMParser",
                       "replaceWith", "document.title", "SDA.pages[route.page]"):
            self.assertIn(needle, source, "router.js is missing %s" % needle)

    def test_router_falls_back_to_a_real_navigation(self):
        source = ROUTER.read_text(encoding="utf-8")
        self.assertIn("window.location.assign(url.href)", source,
                      "a failed client route must fall back to a normal page load")
        self.assertIn("catch(", source, "router.js must handle a failed view fetch")

    def test_every_page_registers_a_route_controller(self):
        for page, script in CONTROLLERS.items():
            source = (ROOT / script).read_text(encoding="utf-8")
            self.assertRegex(source, r"(?:SDA\.)?registerPage\(", "%s must register its controller" % script)
            self.assertIn("'%s'" % PAGES[page], source, "%s must register the %r controller" % (script, PAGES[page]))

    def test_pages_still_serve_real_files_for_deep_links(self):
        for page in PAGES:
            self.assertTrue((ROOT / page).is_file(), "%s must stay a real file" % page)

    def test_interception_skips_fragments_and_external_links(self):
        source = ROUTER.read_text(encoding="utf-8")
        self.assertIn("href.charAt(0) === '#'", source, "in-page fragments must not be intercepted")
        self.assertIn("url.origin !== window.location.origin", source, "external links must not be intercepted")
        self.assertIn("event.metaKey", source, "modified clicks must keep opening new tabs")


if __name__ == "__main__":
    unittest.main()
