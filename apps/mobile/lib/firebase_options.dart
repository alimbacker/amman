// PLACEHOLDER — replace by running, from apps/mobile:
//   dart pub global activate flutterfire_cli
//   flutterfire configure --project=<your-firebase-project-id>
// That command overwrites this file with your project's Android/iOS options.
import 'package:firebase_core/firebase_core.dart' show FirebaseOptions;
import 'package:flutter/foundation.dart' show defaultTargetPlatform, TargetPlatform;

class DefaultFirebaseOptions {
  static FirebaseOptions get currentPlatform {
    switch (defaultTargetPlatform) {
      case TargetPlatform.android:
      case TargetPlatform.iOS:
      default:
        throw UnsupportedError('Run `flutterfire configure` to generate lib/firebase_options.dart');
    }
  }
}
