import os

OUTPUT_FILE = "ai_codebase.txt"

INCLUDE_EXTENSIONS = {
    ".go", ".sql",
    ".js", ".jsx", ".ts", ".tsx",
    ".css", ".html",
    ".json", ".prisma"
}

INCLUDE_FILENAMES = {
    "go.mod", "go.sum",
    "package.json", "package-lock.json",
    "tsconfig.json",
    "vite.config.js", "tailwind.config.js",
    "next.config.js", "next.config.ts",
    "eslint.config.js"
}

EXCLUDE_DIRS = {
    "node_modules", "dist", "build", ".git",
    ".next", "out", "coverage",
    "public", "assets", "logs",
    "__pycache__", ".vscode"
}

EXCLUDE_EXTENSIONS = {
    ".png", ".jpg", ".jpeg", ".gif", ".svg",
    ".ico", ".exe", ".map", ".lock"
}


def should_skip(root, file):
    root_lower = root.lower()

    for d in EXCLUDE_DIRS:
        if d in root_lower:
            return True

    ext = os.path.splitext(file)[1].lower()
    if ext in EXCLUDE_EXTENSIONS:
        return True

    return False


def is_code_file(file):
    ext = os.path.splitext(file)[1].lower()
    if file in INCLUDE_FILENAMES:
        return True
    if ext in INCLUDE_EXTENSIONS:
        return True
    return False


def read_file(path):
    try:
        with open(path, "r", encoding="utf-8") as f:
            return f.read()
    except:
        try:
            with open(path, "r", encoding="latin-1") as f:
                return f.read()
        except:
            return ""


# remove old
if os.path.exists(OUTPUT_FILE):
    os.remove(OUTPUT_FILE)

print("🔍 Scanning entire project...\n")

count = 0

for root, dirs, files in os.walk("."):
    for file in files:
        if should_skip(root, file):
            continue

        if not is_code_file(file):
            continue

        full_path = os.path.join(root, file)
        content = read_file(full_path)

        if not content.strip():
            continue

        rel = os.path.relpath(full_path, ".")

        with open(OUTPUT_FILE, "a", encoding="utf-8") as out:
            out.write(f"\n\n========== FILE: {rel} ==========\n")
            out.write(content)

        count += 1
        print(f"✅ Added: {rel}")

print(f"\n🎉 DONE! {count} files exported to → {OUTPUT_FILE}")