Root config

package.json: lists dependencies and npm scripts (start, android, ios, web, lint). Entry point is expo-router/entry.
package-lock.json: locks exact dependency versions. Auto-generated.
app.json: Expo app config (name, icon, splash, Android package, permissions, plugins, EAS project ID).
eas.json: EAS build profiles (development, preview, production).
tsconfig.json: TypeScript strict mode, with @/* mapped to the project root.
eslint.config.js: lint rules using Expo’s preset.
AGENTS.md: tells AI assistants to read the versioned Expo docs (it says v54, but you’re on 57).
CLAUDE.md: just imports AGENTS.md.
App.tsx: empty and unused.

app/ (delivery app)

_layout.tsx: root navigator. Wraps everything in DeliveryProvider and sets up the stack.
index.tsx: startup check. Sends the user to login, to an unfinished delivery, or to home.
login.tsx: email/password login. Stores the token and user, and locks after 4 failed attempts.
home-screen.tsx: main menu with Scan Package, Sync Saved Packages (shows the queued count), and Log Out. Settings shows only for user ID 193.
scan.tsx: scans package barcodes and adds them to the current delivery. In Standard mode, it recognizes supported carrier formats
package.tsx: review the delivery, enter last name and notes, add a photo and signature, and submit. If the upload fails, it saves the delivery for later sync.
photo.tsx: camera screen for the delivery photo, with retake and use-photo.
signature.tsx: signature pad that saves the signature as a PNG file.
sync.tsx: manages deliveries saved on the device and waiting to upload. You can sync one delivery or all of them, or delete a saved delivery and its photo and signature
settings.tsx: lets user 193 pick the failed-scan sound. It currently crashes because of a stray useState at the top of the file.

app/(tabs)/ and modal.tsx (Expo template leftovers)

(tabs)/_layout.tsx: Home/Explore tab bar from the starter template.
(tabs)/index.tsx: old home screen with a basic logout button, replaced by home-screen.tsx. It also conflicts with app/index.tsx since both resolve to /.
(tabs)/explore.tsx: Expo’s demo Explore page.
modal.tsx: Expo’s demo modal.

api/ folder

- auth.ts: has loginUser(email, password), which sends a POST to /api/login-api.php with JSON { email, pw }. The API returns { success, data: { token, user: { id, email, username } } }. The function returns { token, user } or throws with the server’s error message. It also exports the LoggedInUser type.
- packages.ts: has createPackages(input), which uploads a delivery to /api/create-package.php.
- Request: a POST with a Bearer token and multipart form data.
- Fields: packages (JSON array of { barcode, carrier }), date, time, comment, lastName, optional latitude/longitude.
- Files: signature (required) and photo (optional).
- Validation: it checks for a token, at least one package, a last name, a signature, and non-empty barcodes before sending.
- Response: { success, package_count, inserted_count, updated_count, barcodes, photo_path, signature_path, error, details }. A non-JSON response or success: false throws an error, which package.tsx catches to queue the delivery for sync.
- Helpers: the small functions in the file work out the filename and MIME type from the file extension (jpg/png/webp for photos, png/jpg for signatures).
- Types: it exports CreatePackagesInput and CreatePackagesResponse, and imports Carrier and ScannedPackage from ../types/delivery.
- Endpoints: the API base is https://dataworks-7b7x.onrender.com/api/, with login-api.php, create-package.php, and logout-api.php (called from home-screen.tsx). This fills in the TODO endpoint names.
- File storage: a code comment says the photo and signature are stored in Supabase, with the paths shared by every package in the delivery.
- Duplicate barcodes: a code comment says the API inserts or updates, so resubmitting an existing barcode updates it. The response reports inserted_count and updated_count.
- Hardcoded URLs: the base URL is repeated in three files (auth.ts, packages.ts, home-screen.tsx). A shared constant would be cleaner, and logout has no function in api/.

components/

themed-text.tsx: a Text wrapper that picks a light or dark text color from the theme. It has style types default, title, defaultSemiBold, subtitle, and link.
themed-view.tsx: a View wrapper that picks a light or dark background color from the theme.
external-link.tsx: a link component that opens URLs in an in-app browser on native and a new tab on web.
haptic-tab.tsx: a tab bar button that gives a light haptic tap on iOS. It’s used only by (tabs)/_layout.tsx.
hello-wave.tsx: an animated waving-hand emoji using Reanimated. It isn’t used anywhere in the files you sent.
parallax-scroll-view.tsx: a scroll view with a parallax header image. It’s used only by (tabs)/explore.tsx.

components/ui/

collapsible.tsx: an expandable section with a title and a rotating chevron. It’s used only by explore.tsx.
icon-symbol.tsx: the Android and web icon component. It maps SF Symbol names to Material Icons through a MAPPING table with four icons: house, paperplane, code, and chevron.
icon-symbol.ios.tsx: the iOS version of the same component, using native SF Symbols. Expo picks it automatically on iOS, so keep both files together. (Your upload was named icon-symbol_ios.tsx, but the real filename uses a dot.)

constants/

scanSounds.ts: maps scan sounds to audio files. Successful scans always use assets/sounds/scan.mp3. Failed scans use buzz (A1.mp3) or FAHH (F2.mp3). default means vibration only, with no audio file. It also holds the labels shown in settings (“Vibration Only”, “Buzz”, “FAHH”).
theme.ts: light and dark colors and fonts. It’s an Expo template file, used only by the template components.

context/

DeliveryContext.tsx: holds the delivery in progress and shares it with every screen through useDelivery().
State: delivery, mode (normal or recovered) and loading.
Actions: the package, last name, notes, location, photo and signature setters, plus startNewDelivery, recoverActiveDelivery, releaseCurrentAccount, queueCurrentDelivery, clearCurrentDeliveryAfterUpload and discardCurrentDelivery.
Behavior:
Every change is auto-saved to AsyncStorage, which is how an unfinished delivery survives an app restart.
addPackage rejects duplicate tracking numbers.
Photos are resized to a maximum width of 1600px and compressed to JPEG at 0.65 quality before saving.
Photos and signatures are copied into permanent per-delivery storage.

storage/

accountStorage.ts: saves the logged-in email, lowercased, in SecureStore under accountKey. It’s the key that separates one user’s data from another’s on the same device.
deliveryStorage.ts: all offline persistence, kept separately for each account.
Active delivery: save, get and remove the one in progress.
Sync queue: add, update, remove and list queued deliveries. Each queue entry records when it was queued, the number of upload attempts and the last error.
Files: copies photos and signatures to documentDirectory/deliveries/<account>/<deliveryId>/ and deletes them after upload.
soundSettings.ts: saves and reads the failed-scan sound choice in AsyncStorage. It defaults to default.

types/

delivery.ts: shared types and helpers.
Types: ScannedPackage (raw barcode, tracking number, carrier, time), StoredDelivery, QueuedDelivery and DeliveryMode.
Carriers: usps, ups, fedex, amazon, gofo, ontrac, custom, gls and distribution.
Helpers: createEmptyDelivery, deliveryHasInformation and normalizeStoredDelivery.
Migration: normalizeStoredDelivery also converts the old saved format (barcodes: string[]) to the new packages format, so older saved deliveries still load.

hooks/ (all Expo template)

use-color-scheme.ts: returns the device’s light or dark mode.
use-color-scheme.web.ts: the web version, which waits for hydration before returning the real scheme.
use-theme-color.ts: picks a color from constants/theme based on the current scheme. It’s used by the themed components.

scripts/

reset-project.js: Expo template script behind npm run reset-project. It moves or deletes app/, components/, hooks/, constants/ and scripts/. Don’t run it on this project, since it would wipe your code. Consider deleting it and the script entry in package.json.
