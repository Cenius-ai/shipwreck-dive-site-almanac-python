"""Verification suite for the Shipwreck Dive Site Almanac.

Python standard library only: no pytest, no third-party packages and no
browser. The suite checks the data contract the UI depends on, that every
referenced asset is delivered, and that internal links resolve.

Run from the repository root:

    python3 -m unittest discover -s tests -t .
"""
