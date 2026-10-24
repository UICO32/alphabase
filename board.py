#!/usr/bin/env python3
"""Alphabase project board.

A zero-dependency, read-only local dashboard for this repository.
It parses PROJECT.md (single source of truth) and scans the working tree,
then serves a single-page board on http://127.0.0.1:7788.

Usage:
    python board.py              # start board, open browser
    python board.py --no-open    # start board only
    python board.py --port 7800  # custom port
"""

from __future__ import annotations

import argparse
import json
import os
import platform
import re
import socket
import subprocess
import sys
import threading
import time
import webbrowser
from datetime import datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parent
PROJECT_MD = ROOT / "PROJECT.md"
DEFAULT_PORT = 7788

IGNORE_DIRS = {
    ".git", "node_modules", "dist", "dist-electron", "release", "test-results",
    "playwright-report", "coverage", ".cache", ".tmp", ".codegraph", ".gitnexus",
    ".serena", ".zcode", ".superpowers", ".worktrees", ".claude", ".agents",
    ".codex", ".reasonix", ".playwright-mcp", "__pycache__",
}

STATUS_DONE = ("已完成", "完成", "done", "DONE")
STATUS_DOING = ("进行中", "in progress", "doing", "WIP", "wip")


# ---------------------------------------------------------------------------
# PROJECT.md parsing
# ---------------------------------------------------------------------------

def read_project_md() -> str:
    try:
        return PROJECT_MD.read_text(encoding="utf-8")
    except OSError:
        return ""


def parse_sections(text: str) -> dict[str, list[str]]:
    sections: dict[str, list[str]] = {}
    current: str | None = None
    for line in text.splitlines():
        match = re.match(r"^##\s+(.+?)\s*$", line)
        if match:
            current = match.group(1).strip()
            sections[current] = []
        elif current is not None:
            sections[current].append(line)
    return sections


def parse_table(lines: list[str]) -> list[dict[str, str]]:
    headers: list[str] | None = None
    rows: list[dict[str, str]] = []
    for raw in lines:
        stripped = raw.strip()
        if not stripped.startswith("|"):
            continue
        cells = [cell.strip() for cell in stripped.strip("|").split("|")]
        if headers is None:
            headers = cells
            continue
        if all(cell and set(cell) <= set("-: ") for cell in cells):
            continue
        padded = cells + [""] * (len(headers) - len(cells))
        rows.append(dict(zip(headers, padded)))
    return rows


def cell(row: dict[str, str], *keys: str, default: str = "") -> str:
    for key in keys:
        value = row.get(key, "").strip()
        if value:
            return value
    return default


def status_of(value: str) -> str:
    if value in STATUS_DONE:
        return "已完成"
    if value in STATUS_DOING:
        return "进行中"
    return "待办"


def backticked(text: str) -> list[str]:
    return [item.strip() for item in re.findall(r"`([^`]+)`", text)]


def plain(text: str) -> str:
    return re.sub(r"`([^`]+)`", r"\1", text).strip()


def markdown_paragraphs(lines: list[str]) -> list[str]:
    paragraphs: list[str] = []
    buffer: list[str] = []
    for raw in lines:
        if raw.strip():
            buffer.append(raw.strip())
        elif buffer:
            paragraphs.append(" ".join(buffer))
            buffer = []
    if buffer:
        paragraphs.append(" ".join(buffer))
    return paragraphs


def updated_at(text: str) -> str:
    match = re.search(r"最后更新：\s*([^\n·]+)", text)
    return match.group(1).strip() if match else ""


def load_progress() -> dict:
    text = read_project_md()
    sections = parse_sections(text)

    roadmap = [
        {
            "phase": plain(cell(row, "阶段", "项目", "阶段名")),
            "status": status_of(cell(row, "状态")),
            "note": plain(cell(row, "说明", "备注")),
        }
        for row in parse_table(sections.get("路线图", []))
        if cell(row, "阶段", "项目", "阶段名")
    ]

    structure = []
    for row in parse_table(sections.get("结构", [])):
        note = plain(cell(row, "说明", "备注"))
        for path in backticked(cell(row, "目录", "路径")):
            structure.append({"path": path, "note": note})

    commands = [
        {"cmd": plain(cell(row, "命令")), "purpose": plain(cell(row, "用途", "说明"))}
        for row in parse_table(sections.get("命令", []))
        if cell(row, "命令")
    ]

    launchables = [
        {
            "name": plain(cell(row, "名称")),
            "cmd": plain(cell(row, "命令")),
            "url": plain(cell(row, "地址")),
            "note": plain(cell(row, "说明", "备注")),
        }
        for row in parse_table(sections.get("可启动项", []))
        if cell(row, "名称")
    ]

    documents = [
        {"file": plain(cell(row, "文件")), "note": plain(cell(row, "说明", "备注"))}
        for row in parse_table(sections.get("文档", []))
        if cell(row, "文件")
    ]

    return {
        "updated": updated_at(text),
        "status_paragraphs": markdown_paragraphs(sections.get("当前状态", [])),
        "roadmap": roadmap,
        "structure": structure,
        "commands": commands,
        "launchables": launchables,
        "documents": documents,
    }


# ---------------------------------------------------------------------------
# Working tree scan
# ---------------------------------------------------------------------------

def run(cmd: list[str], timeout: float = 6.0) -> str:
    try:
        result = subprocess.run(
            cmd, cwd=str(ROOT), capture_output=True, text=True,
            timeout=timeout, encoding="utf-8", errors="replace",
        )
        return result.stdout.strip()
    except (OSError, subprocess.SubprocessError):
        return ""


def count_files(path: Path) -> int:
    if not path.exists():
        return 0
    if path.is_file():
        return 1
    total = 0
    for dirpath, dirnames, filenames in os.walk(path):
        dirnames[:] = [name for name in dirnames if name not in IGNORE_DIRS]
        total += len(filenames)
    return total


def subdir_stats(path: Path, limit: int = 8) -> list[dict]:
    if not path.is_dir():
        return []
    children = []
    for child in path.iterdir():
        if not child.is_dir() or child.name in IGNORE_DIRS:
            continue
        children.append({"name": child.name, "count": count_files(child)})
    children.sort(key=lambda item: item["count"], reverse=True)
    return children[:limit]


def scan_structure(structure: list[dict]) -> list[dict]:
    entries = []
    for item in structure:
        relative = item["path"].strip().rstrip("/")
        target = (ROOT / relative).resolve()
        try:
            target.relative_to(ROOT)
        except ValueError:
            continue
        entries.append({
            "path": item["path"],
            "note": item["note"],
            "count": count_files(target),
            "exists": target.exists(),
            "children": subdir_stats(target) if relative.count("/") < 2 else [],
        })
    return entries


def scan_documents(documents: list[dict]) -> list[dict]:
    docs = []
    for item in documents:
        path_text = item["file"].strip().strip("`")
        candidate = (ROOT / path_text).resolve()
        docs.append({
            "file": path_text,
            "note": item["note"],
            "exists": candidate.exists(),
        })
    archived = 0
    archive_dir = ROOT / "docs" / "archive"
    if archive_dir.exists():
        archived = count_files(archive_dir)
    return {"items": docs, "archived": archived}


def scan_tests() -> dict:
    def count_suffix(base: Path, suffix: str) -> int:
        if not base.exists():
            return 0
        return sum(1 for path in base.rglob(f"*{suffix}") if path.is_file())

    unit_files = count_suffix(ROOT / "src", ".test.ts") + count_suffix(ROOT / "src", ".test.tsx")
    unit_files += count_suffix(ROOT / "electron", ".test.ts")
    unit_files += count_suffix(ROOT / "tests" / "unit", ".test.ts")

    last_run = None
    last_run_file = ROOT / "test-results" / ".last-run.json"
    try:
        last_run = json.loads(last_run_file.read_text(encoding="utf-8"))
        last_run = {
            "status": last_run.get("status", "unknown"),
            "failed": len(last_run.get("failedTests", []) or []),
            "at": datetime.fromtimestamp(last_run_file.stat().st_mtime).strftime("%Y-%m-%d %H:%M"),
        }
    except (OSError, ValueError, KeyError):
        last_run = None

    return {
        "unit_files": unit_files,
        "e2e_specs": len(list((ROOT / "tests" / "e2e").glob("*.spec.ts"))) if (ROOT / "tests" / "e2e").exists() else 0,
        "last_run": last_run,
    }


def scan_git() -> dict:
    branch = run(["git", "rev-parse", "--abbrev-ref", "HEAD"]) or "—"
    head_sha = run(["git", "log", "-1", "--format=%h"]) or "—"
    head_subject = run(["git", "log", "-1", "--format=%s"]) or "—"
    head_date = run(["git", "log", "-1", "--format=%ad", "--date=format:%Y-%m-%d %H:%M"]) or "—"
    status_raw = run(["git", "status", "--porcelain=v1"])
    dirty = [line for line in status_raw.splitlines() if line.strip()]
    return {
        "branch": branch,
        "head": {"sha": head_sha, "subject": head_subject, "date": head_date},
        "dirty_files": dirty[:40],
        "dirty_count": len(dirty),
    }


def scan_package() -> dict:
    try:
        data = json.loads((ROOT / "package.json").read_text(encoding="utf-8"))
        return {
            "name": data.get("name", "—"),
            "version": data.get("version", "—"),
            "scripts": list((data.get("scripts") or {}).keys()),
        }
    except (OSError, ValueError):
        return {"name": "—", "version": "—", "scripts": []}


def build_state() -> dict:
    progress = load_progress()
    git = scan_git()
    package = scan_package()
    return {
        "generated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "product": {
            "name": "Alphabase",
            "package": package["name"],
            "version": package["version"],
            "updated": progress["updated"],
        },
        "git": git,
        "status_paragraphs": progress["status_paragraphs"],
        "roadmap": progress["roadmap"],
        "commands": progress["commands"],
        "launchables": progress["launchables"],
        "structure": scan_structure(progress["structure"]),
        "documents": scan_documents(progress["documents"]),
        "tests": scan_tests(),
        "env": {
            "python": platform.python_version(),
            "platform": platform.platform(terse=True),
            "project_md": PROJECT_MD.exists(),
        },
    }


# ---------------------------------------------------------------------------
# HTTP server
# ---------------------------------------------------------------------------

class BoardHandler(BaseHTTPRequestHandler):
    server_version = "AlphabaseBoard/1.0"

    def log_message(self, fmt: str, *args) -> None:  # keep the console clean
        pass

    def _send(self, status: int, body: bytes, content_type: str) -> None:
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self) -> None:  # noqa: N802
        path = urlparse(self.path).path
        if path == "/api/state":
            payload = json.dumps(build_state(), ensure_ascii=False).encode("utf-8")
            self._send(200, payload, "application/json; charset=utf-8")
            return
        if path in ("/", "/index.html"):
            self._send(200, PAGE.encode("utf-8"), "text/html; charset=utf-8")
            return
        if path == "/favicon.ico":
            self._send(204, b"", "image/x-icon")
            return
        self._send(404, b"not found", "text/plain; charset=utf-8")


def bind_server(preferred: int) -> tuple[ThreadingHTTPServer, int]:
    for port in range(preferred, preferred + 30):
        try:
            return ThreadingHTTPServer(("127.0.0.1", port), BoardHandler), port
        except OSError:
            continue
    raise SystemExit("没有可用端口，试试 --port 指定其它端口。")


def main() -> None:
    parser = argparse.ArgumentParser(description="Alphabase 项目看板")
    parser.add_argument("--port", type=int, default=DEFAULT_PORT, help="监听端口（默认 7788）")
    parser.add_argument("--no-open", action="store_true", help="不自动打开浏览器")
    args = parser.parse_args()

    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")

    httpd, port = bind_server(args.port)
    url = f"http://127.0.0.1:{port}/"
    print(f"Alphabase board  ->  {url}")
    print("Ctrl+C 停止。数据源：PROJECT.md + 工作区扫描。")

    if not args.no_open:
        threading.Timer(0.6, lambda: webbrowser.open(url)).start()

    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n已停止。")
    finally:
        httpd.server_close()


PAGE = r"""<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Alphabase · 项目看板</title>
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='9' fill='%235b8cff'/%3E%3C/svg%3E" />
<style>
  :root {
    --bg: #0a0d13;
    --panel: #11151d;
    --panel-2: #151a24;
    --line: rgba(255, 255, 255, 0.07);
    --line-strong: rgba(255, 255, 255, 0.12);
    --text: #e7ebf3;
    --muted: #8c95a8;
    --dim: #5d6678;
    --accent: #5b8cff;
    --green: #3ddc97;
    --amber: #ffb454;
    --red: #ff6b6b;
    --mono: "Cascadia Code", "JetBrains Mono", Consolas, "Courier New", monospace;
    --sans: "Segoe UI", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif;
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; }
  body {
    background:
      radial-gradient(1100px 520px at 12% -10%, rgba(91, 140, 255, 0.14), transparent 62%),
      radial-gradient(900px 460px at 96% 4%, rgba(61, 220, 151, 0.07), transparent 60%),
      var(--bg);
    color: var(--text);
    font-family: var(--sans);
    font-size: 14px;
    line-height: 1.6;
    padding: 28px 24px 56px;
    -webkit-font-smoothing: antialiased;
  }
  .wrap { max-width: 1240px; margin: 0 auto; }
  header.top { display: flex; align-items: center; justify-content: space-between; gap: 20px; flex-wrap: wrap; padding-bottom: 22px; }
  .brand { display: flex; align-items: center; gap: 14px; }
  .mark { width: 38px; height: 38px; border-radius: 11px; background: linear-gradient(145deg, #5b8cff, #3358c9); box-shadow: 0 6px 24px rgba(91, 140, 255, 0.35); position: relative; }
  .mark::after { content: ""; position: absolute; inset: 11px; border-radius: 3px; border: 2px solid rgba(255, 255, 255, 0.85); border-right-color: transparent; border-bottom-color: transparent; transform: rotate(45deg); }
  h1 { font-size: 21px; margin: 0; letter-spacing: 0.2px; }
  .sub { margin: 2px 0 0; color: var(--muted); font-size: 12.5px; }
  .chips { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .chip { display: inline-flex; align-items: center; gap: 6px; padding: 5px 10px; border-radius: 999px; border: 1px solid var(--line-strong); background: rgba(255, 255, 255, 0.03); color: var(--muted); font-size: 12px; font-family: var(--mono); }
  .chip b { color: var(--text); font-weight: 600; }
  .dot { width: 7px; height: 7px; border-radius: 50%; background: var(--green); box-shadow: 0 0 8px rgba(61, 220, 151, 0.7); }
  .dot.warn { background: var(--amber); box-shadow: 0 0 8px rgba(255, 180, 84, 0.7); }
  button { font: inherit; cursor: pointer; }
  .ghost { background: rgba(255, 255, 255, 0.04); color: var(--muted); border: 1px solid var(--line-strong); border-radius: 9px; padding: 6px 12px; font-size: 12px; transition: 120ms ease; }
  .ghost:hover { color: var(--text); border-color: rgba(91, 140, 255, 0.55); background: rgba(91, 140, 255, 0.12); }
  .card { background: linear-gradient(180deg, rgba(255, 255, 255, 0.035), rgba(255, 255, 255, 0.012)); border: 1px solid var(--line); border-radius: 16px; padding: 20px 22px; }
  section { margin-top: 26px; }
  .section-head { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; margin: 0 2px 12px; }
  h2 { font-size: 13px; font-weight: 600; letter-spacing: 1.4px; text-transform: uppercase; color: var(--muted); margin: 0; }
  .hint { color: var(--dim); font-size: 12px; font-family: var(--mono); }
  #status p { margin: 0 0 10px; color: #c8cfdd; max-width: 96ch; }
  #status p:last-child { margin-bottom: 0; }
  .status-meta { display: flex; gap: 18px; flex-wrap: wrap; margin-top: 14px; padding-top: 14px; border-top: 1px dashed var(--line); color: var(--dim); font-size: 12px; font-family: var(--mono); }
  .status-meta b { color: var(--muted); font-weight: 500; }
  .board { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; }
  .col { background: rgba(255, 255, 255, 0.02); border: 1px solid var(--line); border-radius: 16px; padding: 14px; min-height: 120px; }
  .col-head { display: flex; align-items: center; gap: 8px; padding: 2px 4px 12px; font-size: 12px; letter-spacing: 0.6px; color: var(--muted); text-transform: uppercase; }
  .col-head .n { margin-left: auto; font-family: var(--mono); color: var(--dim); }
  .tag { width: 8px; height: 8px; border-radius: 50%; }
  .s-doing .tag { background: var(--accent); box-shadow: 0 0 8px rgba(91,140,255,.8); }
  .s-todo .tag { background: var(--amber); }
  .s-done .tag { background: var(--green); }
  .item { background: var(--panel-2); border: 1px solid var(--line); border-radius: 12px; padding: 12px 13px; margin-bottom: 10px; }
  .item:last-child { margin-bottom: 0; }
  .item .t { font-weight: 600; margin-bottom: 4px; }
  .item .d { color: var(--muted); font-size: 12.5px; }
  .s-done .item { opacity: 0.72; }
  .split { display: grid; grid-template-columns: 1.05fr 1fr; gap: 22px; }
  .rows { display: flex; flex-direction: column; gap: 8px; }
  .row { display: flex; align-items: center; gap: 12px; background: rgba(255,255,255,.02); border: 1px solid var(--line); border-radius: 11px; padding: 9px 12px; }
  .row code { font-family: var(--mono); font-size: 12.5px; color: #cfe0ff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .row .purpose { margin-left: auto; color: var(--muted); font-size: 12px; text-align: right; }
  .copy { flex: none; background: transparent; border: 1px solid var(--line-strong); color: var(--dim); border-radius: 7px; padding: 3px 8px; font-size: 11px; font-family: var(--mono); }
  .copy:hover { color: var(--accent); border-color: rgba(91,140,255,.55); }
  .launch { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
  .launch .card { padding: 15px 16px; }
  .launch .name { font-weight: 600; margin-bottom: 6px; display: flex; align-items: center; gap: 8px; }
  .launch code { display: block; font-family: var(--mono); font-size: 11.5px; color: #9fb4e6; background: rgba(91,140,255,.08); border: 1px solid rgba(91,140,255,.18); border-radius: 7px; padding: 5px 7px; margin: 8px 0; white-space: normal; overflow-wrap: anywhere; }
  .launch .note { color: var(--dim); font-size: 12px; }
  .launch .actions { display: flex; gap: 8px; margin-top: 10px; }
  .link { color: var(--accent); text-decoration: none; font-size: 12px; border: 1px solid rgba(91,140,255,.4); border-radius: 7px; padding: 3px 9px; }
  .link:hover { background: rgba(91,140,255,.14); }
  .tree { display: flex; flex-direction: column; gap: 6px; }
  .trow { display: flex; align-items: baseline; gap: 12px; padding: 8px 12px; border-radius: 10px; border: 1px solid transparent; }
  .trow:hover { background: rgba(255,255,255,.025); border-color: var(--line); }
  .trow .path { font-family: var(--mono); font-size: 12.5px; color: #cfe0ff; }
  .trow .note { color: var(--dim); font-size: 12px; }
  .trow .num { margin-left: auto; font-family: var(--mono); font-size: 11.5px; color: var(--dim); }
  .kids { display: flex; gap: 6px; flex-wrap: wrap; margin: 6px 0 2px 12px; }
  .kid { font-family: var(--mono); font-size: 11px; color: var(--muted); background: rgba(255,255,255,.04); border: 1px solid var(--line); border-radius: 6px; padding: 2px 7px; }
  .stats { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
  .stat { background: rgba(255,255,255,.02); border: 1px solid var(--line); border-radius: 14px; padding: 14px 16px; }
  .stat .v { font-size: 22px; font-weight: 650; letter-spacing: .3px; }
  .stat .k { color: var(--dim); font-size: 11.5px; margin-top: 2px; }
  .ok { color: var(--green); } .bad { color: var(--red); } .warnc { color: var(--amber); }
  .docrow { display: flex; align-items: center; gap: 12px; padding: 8px 10px; border-bottom: 1px dashed var(--line); }
  .docrow:last-child { border-bottom: 0; }
  .docrow .f { font-family: var(--mono); font-size: 12.5px; color: #cfe0ff; }
  .docrow .n { color: var(--dim); font-size: 12px; }
  .miss { color: var(--dim); text-decoration: line-through; }
  footer { margin-top: 34px; color: var(--dim); font-size: 11.5px; display: flex; justify-content: space-between; gap: 12px; flex-wrap: wrap; font-family: var(--mono); }
  .toast { position: fixed; left: 50%; bottom: 26px; transform: translate(-50%, 16px); background: #1b2230; color: var(--text); border: 1px solid var(--line-strong); border-radius: 10px; padding: 9px 16px; font-size: 12.5px; opacity: 0; pointer-events: none; transition: 160ms ease; }
  .toast.show { opacity: 1; transform: translate(-50%, 0); }
  @media (max-width: 980px) {
    .board, .launch { grid-template-columns: 1fr; }
    .split { grid-template-columns: 1fr; }
    .stats { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  }
</style>
</head>
<body>
<div class="wrap">
  <header class="top">
    <div class="brand">
      <span class="mark"></span>
      <div>
        <h1>Alphabase</h1>
        <p class="sub">项目看板 · 数据源 PROJECT.md + 工作区扫描 · 只读</p>
      </div>
    </div>
    <div class="chips" id="chips"></div>
  </header>

  <section class="card" id="status"></section>

  <section>
    <div class="section-head"><h2>路线图</h2><span class="hint" id="roadmap-hint"></span></div>
    <div class="board" id="roadmap"></div>
  </section>

  <div class="split">
    <section>
      <div class="section-head"><h2>命令</h2><span class="hint">点击复制</span></div>
      <div class="rows" id="commands"></div>
    </section>
    <section>
      <div class="section-head"><h2>可启动项</h2><span class="hint">本地入口</span></div>
      <div class="launch" id="launchables"></div>
    </section>
  </div>

  <section>
    <div class="section-head"><h2>项目结构</h2><span class="hint" id="structure-hint"></span></div>
    <div class="card tree" id="structure"></div>
  </section>

  <section class="split">
    <div>
      <div class="section-head"><h2>文档</h2><span class="hint" id="docs-hint"></span></div>
      <div class="card" id="documents"></div>
    </div>
    <div>
      <div class="section-head"><h2>健康摘要</h2><span class="hint">扫描时快照</span></div>
      <div class="stats" id="stats"></div>
      <div class="card" id="dirty" style="margin-top:12px"></div>
    </div>
  </section>

  <footer>
    <span id="foot-left"></span>
    <span id="foot-right"></span>
  </footer>
</div>
<div class="toast" id="toast"></div>

<script>
const $ = (id) => document.getElementById(id);
const esc = (value) => String(value == null ? '' : value).replace(/[&<>"']/g, (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
let state = null;

function toast(message) {
  const el = $('toast');
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.remove('show'), 1400);
}

function copy(text, label) {
  const done = () => toast('已复制：' + (label || text));
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(text).then(done).catch(() => fallbackCopy(text, done));
  } else {
    fallbackCopy(text, done);
  }
}
function fallbackCopy(text, done) {
  const area = document.createElement('textarea');
  area.value = text;
  document.body.appendChild(area);
  area.select();
  try { document.execCommand('copy'); done(); } catch (e) { toast('复制失败，请手动复制'); }
  area.remove();
}

function renderChips() {
  const { product, git } = state;
  const dirty = git.dirty_count > 0;
  $('chips').innerHTML = [
    '<span class="chip">v<b>' + esc(product.version) + '</b></span>',
    '<span class="chip">' + esc(git.branch) + ' · <b>' + esc(git.head.sha) + '</b></span>',
    '<span class="chip"><span class="dot ' + (dirty ? 'warn' : '') + '"></span>' + (dirty ? (git.dirty_count + ' 个改动') : '干净') + '</span>',
    '<button class="ghost" onclick="load()">刷新</button>'
  ].join('');
}

function renderStatus() {
  const paragraphs = state.status_paragraphs.map((p) => '<p>' + esc(p) + '</p>').join('');
  $('status').innerHTML = paragraphs + [
    '<div class="status-meta">',
    '<span><b>最后更新</b> ' + esc(state.product.updated || '—') + '</span>',
    '<span><b>最近提交</b> ' + esc(state.git.head.subject) + '</span>',
    '<span><b>提交时间</b> ' + esc(state.git.head.date) + '</span>',
    '<span><b>生成于</b> ' + esc(state.generated_at) + '</span>',
    '</div>'
  ].join('');
}

function renderRoadmap() {
  const order = [
    { key: '进行中', cls: 's-doing' },
    { key: '待办', cls: 's-todo' },
    { key: '已完成', cls: 's-done' }
  ];
  const groups = {};
  order.forEach((entry) => { groups[entry.key] = []; });
  state.roadmap.forEach((item) => { (groups[item.status] || groups['待办']).push(item); });

  $('roadmap').innerHTML = order.map((entry) => {
    const items = groups[entry.key];
    const cards = items.length
      ? items.map((item) => '<div class="item"><div class="t">' + esc(item.phase) + '</div><div class="d">' + esc(item.note) + '</div></div>').join('')
      : '<div class="item"><div class="d">暂无</div></div>';
    return '<div class="col ' + entry.cls + '"><div class="col-head"><span class="tag"></span>' + entry.key + '<span class="n">' + items.length + '</span></div>' + cards + '</div>';
  }).join('');
  $('roadmap-hint').textContent = state.roadmap.length + ' 个阶段';
}

function renderCommands() {
  $('commands').innerHTML = state.commands.map((item) => [
    '<div class="row">',
    '<code>$ ' + esc(item.cmd) + '</code>',
    '<span class="purpose">' + esc(item.purpose) + '</span>',
    '<button class="copy" onclick="copy(' + JSON.stringify(item.cmd).replace(/"/g, '&quot;') + ')">复制</button>',
    '</div>'
  ].join('')).join('');
}

function renderLaunchables() {
  $('launchables').innerHTML = state.launchables.map((item) => {
    const isUrl = /^https?:\/\//.test(item.url || '');
    return [
      '<div class="card">',
      '<div class="name">' + esc(item.name) + '</div>',
      '<code>' + esc(item.cmd) + '</code>',
      '<div class="note">' + esc(item.note) + '</div>',
      '<div class="actions">',
      isUrl ? '<a class="link" href="' + esc(item.url) + '" target="_blank" rel="noreferrer">打开</a>' : '<span class="hint">' + esc(item.url || '无地址') + '</span>',
      '<button class="copy" onclick="copy(' + JSON.stringify(item.cmd).replace(/"/g, '&quot;') + ')">复制命令</button>',
      '</div></div>'
    ].join('');
  }).join('');
}

function renderStructure() {
  const total = state.structure.reduce((sum, item) => sum + item.count, 0);
  $('structure').innerHTML = state.structure.map((item) => {
    const kids = (item.children || []).map((kid) => '<span class="kid">' + esc(kid.name) + ' ' + kid.count + '</span>').join('');
    return [
      '<div class="trow">',
      '<span class="path ' + (item.exists ? '' : 'miss') + '">' + esc(item.path) + '</span>',
      '<span class="note">' + esc(item.note) + '</span>',
      '<span class="num">' + (item.exists ? item.count + ' 文件' : '缺失') + '</span>',
      '</div>',
      kids ? '<div class="kids">' + kids + '</div>' : ''
    ].join('');
  }).join('');
  $('structure-hint').textContent = state.structure.length + ' 个条目 · 约 ' + total + ' 个文件（不含依赖与产物）';
}

function renderDocuments() {
  $('documents').innerHTML = state.documents.items.map((item) => [
    '<div class="docrow">',
    '<span class="f ' + (item.exists ? '' : 'miss') + '">' + esc(item.file) + '</span>',
    '<span class="n">' + esc(item.note) + '</span>',
    '<button class="copy" style="margin-left:auto" onclick="copy(' + JSON.stringify(item.file).replace(/"/g, '&quot;') + ')">路径</button>',
    '</div>'
  ].join('')).join('');
  $('docs-hint').textContent = '归档 ' + state.documents.archived + ' 个文件（本地）';
}

function renderHealth() {
  const tests = state.tests;
  const last = tests.last_run;
  const lastText = last ? (last.status === 'passed' ? '通过' : '失败') + ' · ' + last.at : '无记录';
  const lastCls = last ? (last.status === 'passed' ? 'ok' : 'bad') : 'warnc';
  $('stats').innerHTML = [
    '<div class="stat"><div class="v">' + tests.unit_files + '</div><div class="k">单测文件</div></div>',
    '<div class="stat"><div class="v">' + tests.e2e_specs + '</div><div class="k">E2E spec</div></div>',
    '<div class="stat"><div class="v ' + lastCls + '" style="font-size:16px;padding-top:5px">' + esc(lastText) + '</div><div class="k">最近一次 E2E</div></div>',
    '<div class="stat"><div class="v">' + esc(state.env.python) + '</div><div class="k">Python</div></div>'
  ].join('');

  const dirty = state.git.dirty_files;
  $('dirty').innerHTML = dirty.length
    ? '<div class="hint" style="margin-bottom:8px">工作区改动</div>' + dirty.map((line) => '<div class="docrow"><span class="f">' + esc(line) + '</span></div>').join('')
    : '<div class="hint">工作区干净 · 与跟踪文档一致</div>';
}

function renderFooter() {
  $('foot-left').textContent = 'PROJECT.md 是唯一事实源；改完文档后刷新本页即可。';
  $('foot-right').textContent = 'Alphabase v' + state.product.version + ' · ' + state.product.package;
}

function render() {
  renderChips();
  renderStatus();
  renderRoadmap();
  renderCommands();
  renderLaunchables();
  renderStructure();
  renderDocuments();
  renderHealth();
  renderFooter();
}

async function load() {
  try {
    const response = await fetch('/api/state', { cache: 'no-store' });
    state = await response.json();
    render();
  } catch (error) {
    $('status').innerHTML = '<p class="bad">读取状态失败：' + esc(error.message) + '</p>';
  }
}

load();
setInterval(load, 60000);
</script>
</body>
</html>
"""


if __name__ == "__main__":
    main()
