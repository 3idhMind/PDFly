#!/usr/bin/env python3
"""
Publish one blog post to PDFly.

WHAT THIS IS FOR
    Put the post in POST below, run the file, and it lands in Firestore. No
    code edit, no git commit, no redeploy by hand.

        python scripts/publish_post.py                 # publish
        python scripts/publish_post.py --check         # validate only, no write
        python scripts/publish_post.py --delete SLUG   # remove a post

SETUP (once)
    Create an API key with the blog:write scope in Settings, then:

        export PDFLY_BLOG_KEY=pdfly_live_xxxxxxxx        # macOS / Linux
        setx PDFLY_BLOG_KEY "pdfly_live_xxxxxxxx"        # Windows, new shell after

    Optional, to make the post live immediately instead of at the next deploy:

        export PDFLY_DEPLOY_HOOK=https://api.vercel.com/v1/integrations/deploy/...

WHY A REBUILD IS NEEDED
    Posts are prerendered into static HTML at build time so crawlers get real
    content instead of an empty shell. Writing to Firestore therefore stages the
    post; the rebuild is what publishes it. With the deploy hook set, this
    script triggers that rebuild for you.

HOUSE STYLE — the API enforces these and will reject the post with a 400:
    no em dash or en dash, no "delve", "leverage", "seamless", "robust",
    no "in today's fast-paced", no "it's not just X, it's Y".
    Write plainly. Use a comma, a colon or a full stop instead of a dash.

    Before publishing, also run the wider check the API does NOT enforce
    (paragraph-length variance, unfilled {{template}} artifacts, stray
    truncated suffixes like "-M" or "-S", double spaces, repeated words):

        node scripts/humanize-check.mjs path/to/post.json

    A clean run there is not proof the post reads as human-written, only
    that it clears the mechanical checks. Read it yourself too.

Only the standard library is used, so there is nothing to pip install.
"""

import argparse
import json
import os
import sys
import urllib.error
import urllib.request

API = os.environ.get("PDFLY_API", "https://pdfly.3idhmind.in")
KEY = os.environ.get("PDFLY_BLOG_KEY", "")
DEPLOY_HOOK = os.environ.get("PDFLY_DEPLOY_HOOK", "")

CATEGORIES = [
    "Exam Guides",
    "Government IDs",
    "PDF Tools",
    "Image Tools",
    "API & Developers",
    "Product Updates",
]

# ---------------------------------------------------------------------------
# EDIT BELOW THIS LINE. Everything above is machinery.
# ---------------------------------------------------------------------------

POST = {
    # Becomes the URL: /blog/<slug>. Lowercase, hyphens, no spaces.
    "slug": "ssc-photo-signature-size-guide",

    "title": "SSC Photo and Signature Size: What the 2026 Notification Actually Says",

    # One or two sentences. Shown on the blog index and in search results.
    "excerpt": (
        "The official SSC notification gives two different signature dimensions "
        "in the same document. Here is what each one says, and which upload "
        "limits are actually enforced by the portal."
    ),

    # Must be one of CATEGORIES above.
    "category": "Exam Guides",

    "tags": ["SSC", "signature size", "photo size", "exam upload"],

    # Markdown. Headings, lists, links and images all work.
    "content": """
## The short answer

SSC asks for a signature scan between 10KB and 20KB, saved as JPEG.

## Where the confusion comes from

The notification lists the signature box as 6.0cm x 2.0cm in one section and
4.0cm x 2.0cm in another. Both appear in the same PDF. The upload form itself
does not check dimensions, only file size and format, so either will be
accepted as long as the file is a JPEG in the stated size range.

## What actually gets rejected

Three things, in order of how often they happen:

1. A file over 20KB.
2. A PNG renamed to .jpg. The portal reads the file header, not the extension.
3. A signature written in anything other than blue or black ink.

## Getting the size right

Resizing to an exact KB target by trial and error wastes time. Our
[signature resizer](/resize-signature-to-10kb) picks the highest quality that
still fits under the limit, and runs entirely in your browser, so the image is
never uploaded anywhere.
""",

    # Optional. A path under /public, or a full URL. Leave empty for none.
    "coverImage": "",

    # Optional ISO date. A future date schedules the post: it stays invisible
    # until then, which is how a five-day cadence is queued up in advance.
    # "publishAt": "2026-08-18T09:00:00Z",
}

# ---------------------------------------------------------------------------
# EDIT ABOVE THIS LINE.
# ---------------------------------------------------------------------------


def call(method: str, path: str, payload: dict | None = None) -> tuple[int, dict]:
    req = urllib.request.Request(
        f"{API}{path}",
        method=method,
        data=json.dumps(payload).encode() if payload else None,
        headers={
            "Authorization": f"Bearer {KEY}",
            "Content-Type": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.status, json.loads(r.read() or b"{}")
    except urllib.error.HTTPError as e:
        body = e.read().decode(errors="replace")
        try:
            return e.code, json.loads(body)
        except json.JSONDecodeError:
            return e.code, {"message": body[:500]}
    except urllib.error.URLError as e:
        print(f"Could not reach {API}: {e.reason}", file=sys.stderr)
        sys.exit(1)


def check_locally(post: dict) -> list[str]:
    """Catch the obvious problems before spending a network round trip."""
    problems = []
    for field in ("slug", "title", "excerpt", "content", "category"):
        if not str(post.get(field, "")).strip():
            problems.append(f"{field} is empty")

    if post.get("category") and post["category"] not in CATEGORIES:
        problems.append(f"category must be one of: {', '.join(CATEGORIES)}")

    prose = f"{post.get('title', '')} {post.get('excerpt', '')} {post.get('content', '')}"
    if "—" in prose or "–" in prose:
        problems.append("contains an em dash or en dash — replace it with a comma or full stop")
    for word in ("delve", "leverage", "seamless", "robust"):
        if word in prose.lower():
            problems.append(f'contains "{word}"')
    return problems


def trigger_deploy() -> None:
    if not DEPLOY_HOOK:
        print("\nPDFLY_DEPLOY_HOOK is not set, so the post is staged but not live yet.")
        print("Set it, or redeploy from the Vercel dashboard, to publish.")
        return
    try:
        urllib.request.urlopen(
            urllib.request.Request(DEPLOY_HOOK, method="POST", data=b"{}"), timeout=30
        )
        print("Rebuild triggered. The post is usually live in about two minutes.")
    except urllib.error.URLError as e:
        print(f"Post saved, but the deploy hook failed: {e.reason}", file=sys.stderr)


def main() -> None:
    ap = argparse.ArgumentParser(description="Publish a blog post to PDFly.")
    ap.add_argument("--check", action="store_true", help="validate only, write nothing")
    ap.add_argument("--delete", metavar="SLUG", help="delete a post by slug")
    args = ap.parse_args()

    if not KEY:
        print("PDFLY_BLOG_KEY is not set. Create a key with the blog:write scope", file=sys.stderr)
        print("in Settings, then export it. See the docstring at the top.", file=sys.stderr)
        sys.exit(1)

    if args.delete:
        status, body = call("DELETE", f"/api/blog?slug={args.delete}")
        print(f"[{status}] {json.dumps(body)}")
        sys.exit(0 if status < 400 else 1)

    problems = check_locally(POST)
    if problems:
        print("Post rejected before sending:\n")
        for p in problems:
            print(f"  - {p}")
        sys.exit(1)

    words = len(POST["content"].split())
    print(f'"{POST["title"]}"')
    print(f"  slug     /blog/{POST['slug']}")
    print(f"  category {POST['category']}")
    print(f"  length   {words} words, about {max(1, round(words / 200))} min read")

    if args.check:
        print("\nLooks fine. Nothing was written (--check).")
        return

    status, body = call("POST", "/api/blog", POST)
    if status >= 400:
        print(f"\nRejected ({status}): {body.get('message', '')}", file=sys.stderr)
        for err in body.get("errors", []):
            print(f"  - {err}", file=sys.stderr)
        sys.exit(1)

    print(f"\n{'Created' if body.get('created') else 'Updated'}: {body.get('url')}")
    trigger_deploy()


if __name__ == "__main__":
    main()
