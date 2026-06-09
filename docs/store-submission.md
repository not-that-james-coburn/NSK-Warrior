# Store submission and owner checklist

The native build configuration in this repo is enough to start producing test artifacts, but public store approval still requires account, signing, metadata, testing, and reviewer-submission work that cannot be fully completed from the repository alone.

## What is already set up

- Android and iOS native shells use Capacitor in hosted mode and point at the deployed Netlify PWA.
- The Netlify PWA remains the single source of truth for the web experience and game asset delivery.
- GitHub Actions can generate an Android debug APK and an unsigned iOS simulator app for smoke testing.
- Windows PWABuilder metadata is versioned in the repo so the Windows package request can be generated consistently.

## What still needs to happen

### 1. Verify the hosted app before store submission

Before submitting to any store, confirm that `https://nsk-warrior.netlify.app` is production-ready because Android/iOS hosted-mode wrappers load that URL at runtime.

Owner tasks:

- Confirm the production URL, app name, support email, website URL, privacy policy URL, and store descriptions are final.
- Test a full game session from the production URL, including game asset download, save/import/share/delete behavior, offline behavior, booklet controls, gamepad behavior, and reload behavior.
- Confirm all required ROM/BIOS assets exist in Netlify Blobs and that `/api/serve-game/*` works from the production host.
- Prepare final screenshots, feature graphic/banner art, app icon, age-rating answers, support contact details, and review notes.

### 2. Add release signing when you are ready to publish

The current workflows are intentionally unsigned/test-oriented. Public stores require signed release artifacts.

Owner tasks:

- Create developer accounts for Google Play Console, Apple Developer/App Store Connect, and Microsoft Partner Center.
- Decide who owns the app identifiers and certificates permanently. These identities are difficult or impossible to reuse after submission.
- Add repository or organization secrets for Android, iOS, and Windows signing only after the release process is agreed.
- Add release workflows after credentials are available. The current workflows are safe starter workflows and avoid committing certificates or private keys.

### 3. Decide whether hosted mode is acceptable for Apple review

Android and Windows generally align well with hosted PWA packaging. iOS can be stricter: Apple App Review Guideline 4.2 expects an app to provide lasting value and not feel like only a repackaged website. NSK Warrior is a playable game rather than a generic website, which helps, but Apple may still scrutinize a hosted WebView wrapper.

Recommended owner tasks for iOS:

- Add App Review notes explaining that the app is a complete playable game, not a marketing page or link collection.
- Emphasize the game content, fullscreen play, offline/service-worker behavior, save-state functionality, booklet, and gamepad/touch controls.
- Test on real iPhone/iPad hardware before submitting.
- Be prepared to add small native integrations later if Apple asks for more app-specific behavior, such as native orientation handling, native share hooks, haptics, or local notification hooks.

## Android approval process

1. Register or use an existing Google Play Console developer account.
2. Create the app in Play Console with the final app/game name, default language, free/paid choice, contact email, declarations, and Play App Signing acceptance.
3. Generate a release Android App Bundle (`.aab`), not just the debug APK currently produced by CI.
4. Sign the release upload with your upload key or configure Play App Signing.
5. Complete Play Console dashboard tasks: store listing, screenshots, content rating, target audience, data safety/privacy disclosures, ads declaration, app category/tags, support contact, and countries/regions.
6. Run internal or closed testing first. Personal Play Console accounts created after November 13, 2023 may have additional testing requirements before production release.
7. Submit changes for review through the Publishing overview, optionally using managed publishing so approval and public rollout are separate steps.
8. If rejected, fix the policy or technical issue, increment the Android version code, upload a new bundle, and resubmit.

## iOS approval process

1. Join or use an Apple Developer Program account.
2. Create or confirm the bundle identifier that matches `app.nskwarrior.game`.
3. Generate the iOS project with Capacitor, configure signing in Xcode, and create an archive for distribution.
4. Upload a signed build through Xcode, Transporter, Xcode Cloud, or App Store Connect API tooling.
5. Create the app record in App Store Connect with app name, SKU, bundle ID, primary language, age rating, category, screenshots, privacy details, support URL, marketing URL, and review notes.
6. Use TestFlight for internal/external testing before production review.
7. Select the processed build for the app version and submit it to App Review.
8. If rejected, respond in App Store Connect with clarification or submit a corrected build. For WebView/minimum-functionality concerns, update review notes and/or add native functionality if needed.

## Windows approval process

1. Register or use a Microsoft Partner Center developer account.
2. Use PWABuilder with the production URL and the metadata in `native/pwabuilder-windows.json` to generate the Windows/MSIX package.
3. Test the package locally and run the Windows App Certification Kit before submission.
4. Create a Microsoft Store app submission with package, Store listing, screenshots, age rating, pricing/availability, support details, privacy policy, and certification notes.
5. Submit to certification. Microsoft states certification can take up to three business days, and approved listings normally appear shortly after publishing completes.
6. If certification fails, use the certification report to fix the package, policy, or listing issue, then create a new submission.

## Recommended next implementation steps

These are not required for the Netlify web app to keep working, but they are recommended before public store launch:

1. Add a release Android workflow that produces a signed `.aab` once Android keystore secrets are available.
2. Add an iOS release workflow after Apple signing assets and App Store Connect API credentials are available.
3. Decide whether Windows should remain PWABuilder/manual or move to a fully generated Windows wrapper using a tool such as Electron, Tauri, or Microsoft's Windows App SDK/MSIX tooling.
4. Add platform-specific release notes and review-note templates under `docs/` so each submission explains the hosted PWA/game architecture consistently.
5. Run at least one end-to-end manual QA pass on Android hardware, iPhone/iPad hardware, and Windows before submitting to stores.


## Official references

- Google Play Console: Create and set up your app — https://support.google.com/googleplay/android-developer/answer/9859152
- Google Play Console: Use Play App Signing — https://support.google.com/googleplay/android-developer/answer/9842756
- Apple Developer: App Store Review Guidelines — https://developer.apple.com/app-store/review/guidelines/
- Apple Developer: Upload builds — https://developer.apple.com/help/app-store-connect/manage-builds/upload-builds
- Apple Developer: Submit an app — https://developer.apple.com/help/app-store-connect/manage-submissions-to-app-review/submit-an-app/
- Microsoft Learn: Create an app submission for your PWA — https://learn.microsoft.com/en-us/windows/apps/publish/publish-your-app/pwa/create-app-submission
- Microsoft Learn: The app certification process for PWA — https://learn.microsoft.com/en-us/windows/apps/publish/publish-your-app/pwa/app-certification-process
