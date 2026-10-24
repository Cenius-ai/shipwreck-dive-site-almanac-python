"""Every static asset a page references must be delivered at that exact path."""

import re
import unittest
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

PAGES = ["index.html", "wreck.html", "briefing.html", "signin.html", "log.html"]
STYLESHEETS = ["assets/css/styles.css", "assets/css/print.css"]
SCRIPTS = [
    "assets/js/app.js",
    "assets/js/data.js",
    "assets/js/slack.js",
    "assets/js/wreck.js",
    "assets/js/briefing.js",
    "assets/js/session.js",
    "assets/js/log.js",
    "assets/js/router.js",
]
OTHER_ASSETS = ["assets/favicon.svg", "data.json"]

EXTERNAL_PREFIXES = ("http://", "https://", "//", "data:", "mailto:", "tel:", "javascript:")


class ReferenceCollector(HTMLParser):
    """Collects every href/src a page points at."""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.references = []

    def handle_starttag(self, tag, attrs):
        for name, value in attrs:
            if name in ("href", "src") and value:
                self.references.append((tag, value))


def html_files():
    return sorted(path for path in ROOT.glob("*.html"))


def references_in(path):
    collector = ReferenceCollector()
    collector.feed(path.read_text(encoding="utf-8"))
    return collector.references


def local_target(source, reference):
    """Maps a reference to a filesystem path, or None when it is not local."""
    if reference.startswith(EXTERNAL_PREFIXES):
        return None
    without_query = reference.split("#")[0].split("?")[0]
    if not without_query:
        return None
    return (source.parent / without_query).resolve()


class AssetExistenceTests(unittest.TestCase):
    def test_required_pages_exist_at_the_repository_root(self):
        for page in PAGES:
            path = ROOT / page
            self.assertTrue(path.is_file(), "%s must be served from the repository root" % page)
            self.assertGreater(path.stat().st_size, 500, "%s should hold a real page" % page)

    def test_required_stylesheets_scripts_and_data_exist(self):
        for relative in STYLESHEETS + SCRIPTS + OTHER_ASSETS:
            self.assertTrue((ROOT / relative).is_file(), "%s is missing" % relative)

    def test_every_referenced_local_asset_exists_on_disk(self):
        checked = 0
        for page in html_files():
            for tag, reference in references_in(page):
                target = local_target(page, reference)
                if target is None:
                    continue
                checked += 1
                self.assertTrue(
                    target.is_file(),
                    "%s references %r (tag <%s>) but %s does not exist" % (page.name, reference, tag, target),
                )
        self.assertGreater(checked, 10, "the pages should reference their stylesheets and scripts")

    def test_print_stylesheet_is_linked_for_print_media(self):
        for page in html_files():
            markup = page.read_text(encoding="utf-8")
            self.assertIn('href="./assets/css/print.css"', markup, "%s must load print.css" % page.name)
            self.assertIn('media="print"', markup, "%s must load print.css for print only" % page.name)

    def test_no_external_hosts_are_referenced(self):
        for page in html_files():
            for _tag, reference in references_in(page):
                self.assertFalse(
                    reference.startswith(("http://", "https://", "//")),
                    "%s loads a remote asset: %s" % (page.name, reference),
                )
        for stylesheet in sorted(ROOT.glob("assets/css/*.css")):
            text = stylesheet.read_text(encoding="utf-8")
            self.assertNotRegex(text, r"@import\s+url\(\s*['\"]?https?:", "%s imports a remote sheet" % stylesheet.name)
            self.assertNotRegex(text, r"url\(\s*['\"]?https?:", "%s fetches a remote file" % stylesheet.name)

    def test_javascript_makes_no_remote_requests(self):
        for script in sorted(ROOT.glob("assets/js/*.js")):
            text = script.read_text(encoding="utf-8")
            self.assertNotRegex(
                text,
                r"fetch\(\s*['\"](?:https?:)?//",
                "%s fetches a remote URL" % script.name,
            )
            self.assertNotRegex(text, r"XMLHttpRequest|importScripts", "%s should stay offline" % script.name)

    def test_every_javascript_file_is_referenced_by_a_page(self):
        referenced = set()
        for page in html_files():
            for _tag, reference in references_in(page):
                if reference.endswith(".js"):
                    referenced.add(reference.lstrip("./"))
        for script in SCRIPTS:
            self.assertIn(script, referenced, "%s is shipped but never loaded" % script)

    def test_stylesheets_have_balanced_braces(self):
        for stylesheet in sorted(ROOT.glob("assets/css/*.css")):
            text = stylesheet.read_text(encoding="utf-8")
            without_comments = re.sub(r"/\*.*?\*/", "", text, flags=re.S)
            self.assertEqual(
                without_comments.count("{"),
                without_comments.count("}"),
                "%s has unbalanced braces" % stylesheet.name,
            )

    def test_one_token_block_in_the_design_system(self):
        text = (ROOT / "assets/css/styles.css").read_text(encoding="utf-8")
        self.assertEqual(len(re.findall(r":root\s*\{", text)), 1, "exactly one :root token block")
        for token in ("--background", "--foreground", "--accent", "--ring", "--border", "--muted-foreground"):
            self.assertIn(token + ":", text, "the design tokens must be committed in styles.css")

    def test_no_nodejs_or_build_artifacts_in_the_repository(self):
        for forbidden in ("package.json", "package-lock.json", "yarn.lock", "node_modules", "vite.config.js"):
            self.assertFalse((ROOT / forbidden).exists(), "%s must not exist in a no-build static site" % forbidden)
        self.assertEqual(sorted(ROOT.glob("*.jsx")), [], "no JSX compilation in a no-build site")


if __name__ == "__main__":
    unittest.main()
