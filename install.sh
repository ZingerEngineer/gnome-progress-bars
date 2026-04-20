#!/bin/bash
set -e

UUID="progress-bars@ZingerEngineer.github.com"
EXTENSIONS_DIR="$HOME/.local/share/gnome-shell/extensions"
SRC="$(cd "$(dirname "$0")" && pwd)"
BUILD="$SRC/gnome-shell-extension"
DEST="$EXTENSIONS_DIR/$UUID"

mkdir -p "$EXTENSIONS_DIR"
mkdir -p "$BUILD/schemas"

# Compile TypeScript → gnome-shell-extension/
echo "Compiling TypeScript..."
(cd "$SRC" && npx tsc)

# Concatenate CSS partials → stylesheet.css in the build dir
echo "Bundling stylesheet..."
cat "$SRC/src/styles/"*.css > "$BUILD/stylesheet.css"

# Copy static assets the Shell loader expects alongside extension.js
cp "$SRC/metadata.json" "$BUILD/metadata.json"
cp "$SRC/schemas/org.gnome.shell.extensions.progress-bars.gschema.xml" "$BUILD/schemas/"

# Copy panel icons (light/dark variants) from the assets logo dir.
mkdir -p "$BUILD/icons"
cp "$SRC/assets/extension_assets/logo/progress-bar-light.svg" "$BUILD/icons/progress-bar-light.svg"
cp "$SRC/assets/extension_assets/logo/progress-bar-dark.svg" "$BUILD/icons/progress-bar-dark.svg"

# Copy action icons used by TrackItem (eye / cross / check, light + dark).
# The `logo/` subdir is skipped — its contents are already placed above.
for f in "$SRC/assets/extension_assets/"*.svg; do
    [ -f "$f" ] && cp "$f" "$BUILD/icons/"
done

# Copy the bundled icon library (monochrome + colored) for the IconPicker.
if [ -d "$SRC/assets/icons" ]; then
    rm -rf "$BUILD/icon-library"
    mkdir -p "$BUILD/icon-library"
    cp -r "$SRC/assets/icons/." "$BUILD/icon-library/"
fi

# Compile GSettings schema inside the build dir
glib-compile-schemas "$BUILD/schemas/"
echo "Schema compiled."

# Create or refresh the symlink → the build dir
if [ -L "$DEST" ]; then
    rm "$DEST"
    echo "Removed old symlink."
elif [ -d "$DEST" ]; then
    echo "ERROR: $DEST exists as a real directory, not a symlink."
    echo "Move it away first, then re-run this script."
    exit 1
fi

ln -s "$BUILD" "$DEST"
echo "Linked: $BUILD → $DEST"

echo ""
echo "Done. Now run:"
echo "  gnome-extensions enable $UUID"
echo ""
echo "To reload after changes:"
echo "  gnome-extensions disable $UUID && gnome-extensions enable $UUID"
echo ""
echo "To watch logs:"
echo "  journalctl -f -o cat /usr/bin/gnome-shell"
