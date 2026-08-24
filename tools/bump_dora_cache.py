#!/usr/bin/env python3
"""Поднимает ?v=YYYYMMDDNN в dora/index.html и dora/tests.html.

Вызывается из pre-commit хука (.githooks/pre-commit). Если в индексе есть
изменения под dora/js/ или dora/style.css — вычисляет новый токен кеш-бастинга
(тот же день -> счётчик +1, новый день -> 01), заменяет его в обоих html
и добавляет их в индекс. Иначе выходит ничего не делая.
"""
import re
import subprocess
import sys
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
HTML_FILES = ["dora/index.html", "dora/tests.html"]
TOKEN_RE = re.compile(r"\?v=(\d{8})(\d{2})")


def staged_dora_assets():
    out = subprocess.run(
        ["git", "diff", "--cached", "--name-only"],
        capture_output=True, text=True, cwd=ROOT, check=True,
    ).stdout
    files = [line.strip() for line in out.splitlines() if line.strip()]
    return [f for f in files if f.startswith("dora/js/") or f == "dora/style.css"]


def read_text(path):
    with open(path, "r", encoding="utf-8", newline="") as f:
        return f.read()


def write_text(path, text):
    with open(path, "w", encoding="utf-8", newline="") as f:
        f.write(text)


def main():
    if not staged_dora_assets():
        return 0

    tokens = []
    for rel in HTML_FILES:
        tokens.extend(TOKEN_RE.findall(read_text(ROOT / rel)))
    if not tokens:
        print("[bump_dora_cache] токены ?v= не найдены — пропуск")
        return 0

    cur_date, cur_nn = max(tokens)
    today = date.today().strftime("%Y%m%d")
    if cur_date == today:
        new_nn = int(cur_nn) + 1
        if new_nn > 99:
            print("[bump_dora_cache] счётчик 99 исчерпан — пропуск")
            return 0
    else:
        new_nn = 1
    new_token = f"?v={today}{new_nn:02d}"
    old_token = f"?v={cur_date}{cur_nn}"

    changed = []
    for rel in HTML_FILES:
        path = ROOT / rel
        text = read_text(path)
        if old_token in text:
            write_text(path, text.replace(old_token, new_token))
            changed.append(rel)

    if not changed:
        print(f"[bump_dora_cache] токен {old_token} не найден в html — пропуск")
        return 0

    subprocess.run(["git", "add"] + [str(ROOT / rel) for rel in changed],
                   cwd=ROOT, check=True)
    print(f"[bump_dora_cache] {old_token} -> {new_token} ({', '.join(changed)})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
