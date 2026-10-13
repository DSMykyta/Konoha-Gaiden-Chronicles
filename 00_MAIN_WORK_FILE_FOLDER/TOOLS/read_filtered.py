#!/usr/bin/env python3
"""Read a UTF-8 story file without exposing marked sexual passages."""
from pathlib import Path
import sys

START = "[[SKIP_SEX_SCENE_START]]"
END = "[[SKIP_SEX_SCENE_END]]"
REDACTED = "[ІНТИМНУ СЦЕНУ ПРОПУЩЕНО]"

def filtered_text(source: str) -> str:
    result = []
    inside = False
    for line_number, line in enumerate(source.splitlines(keepends=True), 1):
        token = line.strip()
        if token == START:
            if inside:
                raise ValueError(f"Nested START marker on line {line_number}")
            inside = True
            result.append(REDACTED + "\n")
        elif token == END:
            if not inside:
                raise ValueError(f"Unmatched END marker on line {line_number}")
            inside = False
        elif START in line or END in line:
            raise ValueError(f"Marker must be on its own line: {line_number}")
        elif not inside:
            result.append(line)
    if inside:
        raise ValueError("Missing END marker")
    return "".join(result)

def main() -> int:
    if len(sys.argv) != 2:
        print("Usage: python read_filtered.py <story-file>", file=sys.stderr)
        return 2
    try:
        source = Path(sys.argv[1]).read_text(encoding="utf-8")
        safe = filtered_text(source)
    except (OSError, UnicodeError, ValueError) as error:
        print(f"Safe-read failed (no text emitted): {error}", file=sys.stderr)
        return 1
    sys.stdout.write(safe)
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
