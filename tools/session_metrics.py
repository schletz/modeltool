"""Summarize time and token usage of a Claude Code session.

Reads the JSONL transcript of a session (plus the transcripts of all subagents
it spawned) from ``~/.claude/projects/<project>/`` and prints wall-clock time
and token usage (input, output, cache read, cache write), split by model and
by main session vs. subagents.

Usage:
    python tools/session_metrics.py <session-id> [--since ISO_TIMESTAMP]
        [--project-dir DIR] [--markdown]
"""

from __future__ import annotations

import argparse
import json
import sys
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path


@dataclass
class Usage:
    """Accumulated token counts of a group of API calls."""

    calls: int = 0
    input: int = 0
    output: int = 0
    cache_read: int = 0
    cache_write: int = 0

    def add(self, usage: dict) -> None:
        self.calls += 1
        self.input += usage.get("input_tokens", 0) or 0
        self.output += usage.get("output_tokens", 0) or 0
        self.cache_read += usage.get("cache_read_input_tokens", 0) or 0
        self.cache_write += usage.get("cache_creation_input_tokens", 0) or 0

    @property
    def total(self) -> int:
        return self.input + self.output + self.cache_read + self.cache_write


@dataclass
class Report:
    """Aggregated metrics of one session."""

    start: datetime | None = None
    end: datetime | None = None
    by_source: dict[str, Usage] = field(default_factory=lambda: defaultdict(Usage))
    by_model: dict[str, Usage] = field(default_factory=lambda: defaultdict(Usage))
    total: Usage = field(default_factory=Usage)


def parse_time(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def default_project_dir() -> Path:
    """Derive the transcript folder Claude Code uses for the current directory."""
    cwd = str(Path.cwd())
    mangled = "".join(c if c.isalnum() else "-" for c in cwd)
    root = Path.home() / ".claude" / "projects"
    # The drive letter casing differs between invocations, so match case-insensitively.
    for candidate in root.iterdir():
        if candidate.name.lower() == mangled.lower():
            return candidate
    return root / mangled


def subagent_label(path: Path) -> str:
    """Label of a subagent transcript: the task description from its .meta.json, if any."""
    meta = path.with_name(path.name.replace(".jsonl", ".meta.json"))
    try:
        description = json.loads(meta.read_text(encoding="utf-8")).get("description")
    except (OSError, json.JSONDecodeError):
        description = None
    return f"subagent: {description or path.stem}"


def transcript_files(project_dir: Path, session_id: str) -> list[tuple[str, Path]]:
    """Return (source label, path) for the main transcript and all subagent transcripts."""
    files: list[tuple[str, Path]] = []
    main = project_dir / f"{session_id}.jsonl"
    if main.exists():
        files.append(("main", main))
    sub_dir = project_dir / session_id
    if sub_dir.is_dir():
        files.extend((subagent_label(p), p) for p in sorted(sub_dir.rglob("*.jsonl")))
    return files


USAGE_FIELDS = ("input_tokens", "output_tokens", "cache_read_input_tokens", "cache_creation_input_tokens")


def collect(files: list[tuple[str, Path]], since: datetime | None) -> Report:
    report = Report()
    # A streamed API response is written as several lines (one per content block). They
    # repeat the usage, and output_tokens grows until the last line, so every message id
    # is counted once with the maximum of each field.
    messages: dict[str, tuple[str, str, dict]] = {}
    for source, path in files:
        with path.open(encoding="utf-8") as handle:
            for line in handle:
                try:
                    entry = json.loads(line)
                except json.JSONDecodeError:
                    continue
                stamp = entry.get("timestamp")
                if not stamp:
                    continue
                when = parse_time(stamp)
                if since and when < since:
                    continue
                if source == "main":
                    report.start = min(report.start or when, when)
                    report.end = max(report.end or when, when)
                message = entry.get("message") or {}
                usage = message.get("usage")
                if entry.get("type") != "assistant" or not usage:
                    continue
                key = message.get("id") or entry.get("requestId") or entry.get("uuid")
                _, _, known = messages.get(key, (source, "", {}))
                merged = {f: max(known.get(f, 0) or 0, usage.get(f, 0) or 0) for f in USAGE_FIELDS}
                messages[key] = (source, message.get("model", "unknown"), merged)
    for source, model, usage in messages.values():
        group = "main" if source == "main" else "subagents"
        report.by_source[group].add(usage)
        if group != "main":
            report.by_source[source].add(usage)
        report.by_model[model].add(usage)
        report.total.add(usage)
    if since:
        report.start = since
    return report


def format_duration(seconds: float) -> str:
    minutes, sec = divmod(int(seconds), 60)
    hours, minutes = divmod(minutes, 60)
    return f"{hours}h {minutes:02d}m {sec:02d}s"


def render(report: Report, markdown: bool) -> str:
    rows = [("Total", report.total)]
    rows += [(k if k.startswith("subagent:") else f"Source: {k}", v) for k, v in sorted(report.by_source.items())]
    rows += [(f"Model: {k}", v) for k, v in sorted(report.by_model.items())]
    header = ("", "API calls", "Input", "Output", "Cache read", "Cache write", "Sum")
    lines: list[str] = []
    if report.start and report.end:
        duration = (report.end - report.start).total_seconds()
        lines.append(f"Start:    {report.start.isoformat()}")
        lines.append(f"End:      {report.end.isoformat()}")
        lines.append(f"Duration: {format_duration(duration)}")
        lines.append("")
    table = [header] + [
        (label, f"{u.calls:,}", f"{u.input:,}", f"{u.output:,}",
         f"{u.cache_read:,}", f"{u.cache_write:,}", f"{u.total:,}")
        for label, u in rows
    ]
    if markdown:
        lines.append("| " + " | ".join(table[0]) + " |")
        lines.append("|" + "|".join(["---"] + ["---:"] * (len(header) - 1)) + "|")
        lines += ["| " + " | ".join(r) + " |" for r in table[1:]]
    else:
        widths = [max(len(r[i]) for r in table) for i in range(len(header))]
        for r in table:
            lines.append("  ".join(c.ljust(w) if i == 0 else c.rjust(w)
                                   for i, (c, w) in enumerate(zip(r, widths))))
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("session_id")
    parser.add_argument("--since", help="ignore entries before this ISO timestamp")
    parser.add_argument("--project-dir", type=Path, help="transcript folder")
    parser.add_argument("--markdown", action="store_true", help="output a Markdown table")
    args = parser.parse_args()

    project_dir = args.project_dir or default_project_dir()
    files = transcript_files(project_dir, args.session_id)
    if not files:
        print(f"No transcript for session {args.session_id} in {project_dir}", file=sys.stderr)
        return 1
    since = parse_time(args.since) if args.since else None
    print(render(collect(files, since), args.markdown))
    return 0


if __name__ == "__main__":
    sys.exit(main())
