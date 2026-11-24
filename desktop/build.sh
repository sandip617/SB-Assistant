#!/bin/zsh
# Builds dist/SB.app and dist/SB.dmg from the downloaded Electron, with no extra build tools.
# Only the small app shell (main.js, preload.js) goes inside; SB's code and keys stay outside the bundle.
set -euo pipefail
cd "$(dirname "$0")"
APP=dist/SB.app; P="$APP/Contents/Info.plist"; PB=/usr/libexec/PlistBuddy
rm -rf dist && mkdir -p dist
ditto node_modules/electron/dist/Electron.app "$APP"
mkdir -p "$APP/Contents/Resources/app"
cp main.js preload.js package.json "$APP/Contents/Resources/app/"
cp icon/SB.icns "$APP/Contents/Resources/sb.icns"
setp() { $PB -c "Set :$1 $2" "$P" 2>/dev/null || $PB -c "Add :$1 string $2" "$P"; }
mv "$APP/Contents/MacOS/Electron" "$APP/Contents/MacOS/SB" # Electron treats an app whose binary is named Electron as a dev build
setp CFBundleExecutable SB
setp CFBundleName SB
setp CFBundleDisplayName SB
setp CFBundleIdentifier com.sb.assistant.app
setp CFBundleIconFile sb.icns
setp CFBundleShortVersionString "$(/usr/bin/sed -n 's/.*"version": *"\([^"]*\)".*/\1/p' package.json)"
setp LSApplicationCategoryType public.app-category.productivity
setp NSMicrophoneUsageDescription "SB তোমার কথা শুনতে মাইক ব্যবহার করে। Hands-free চালু থাকলেই শুধু শোনে।"
setp NSAppleEventsUsageDescription "SB তোমার অনুমতিতে Mail, Calendar, Safari আর Contacts থেকে তথ্য পড়ে আর Mac-এর ছোট কাজ করে।"
setp NSContactsUsageDescription "WhatsApp বা mail-এর জন্য নাম খুঁজতে SB Contacts দেখে।"
setp NSDesktopFolderUsageDescription "তুমি বললে SB Desktop-এর ফাইল পড়ে।"
setp NSDocumentsFolderUsageDescription "তুমি বললে SB Documents-এর ফাইল পড়ে।"
setp NSDownloadsFolderUsageDescription "তুমি বললে SB Downloads-এর ফাইল পড়ে।"
setp NSCameraUsageDescription "SB ক্যামেরা ব্যবহার করে না।"
# Signed with this Mac's Apple Development certificate when there is one, so macOS keeps the permissions it gave SB across rebuilds.
# Without one it falls back to an ad-hoc signature, and permissions may be asked again after each rebuild.
ID=${SB_SIGN_ID:-$(security find-identity -v -p codesigning | awk '/Apple Development/{print $2; exit}')}
xattr -cr "$APP"
if [[ -n "$ID" ]]; then codesign --force --deep --timestamp=none --sign "$ID" "$APP"; else codesign --force --deep --sign - "$APP"; fi
codesign --verify --deep "$APP"
STAGE=$(mktemp -d); ditto "$APP" "$STAGE/SB.app"; ln -s /Applications "$STAGE/Applications"
hdiutil create -quiet -volname SB -srcfolder "$STAGE" -ov -format UDZO dist/SB.dmg
rm -rf "$STAGE"
echo "built: $(du -sh "$APP" | cut -f1) app, $(du -sh dist/SB.dmg | cut -f1) dmg"
