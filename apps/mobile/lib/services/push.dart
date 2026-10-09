import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/material.dart';

import 'api.dart';

/// Firebase Cloud Messaging: booking confirmations, payment rejections and temple announcements.
class Push {
  static bool _started = false;
  static String _lang = 'ta';

  /// Call after the first frame. Safe to call again when the language changes (re-subscribes topics).
  static Future<void> init({required String lang, required GlobalKey<ScaffoldMessengerState> messenger, required void Function(String bookingId) onOpenBooking}) async {
    _lang = lang;
    final fm = FirebaseMessaging.instance;
    try {
      final perm = await fm.requestPermission(alert: true, badge: true, sound: true);
      if (perm.authorizationStatus == AuthorizationStatus.denied) return;
      final token = await fm.getToken();
      if (token != null) await Api.registerDevice(token, lang);
    } catch (_) {
      return; // push is best-effort; booking works without it
    }
    if (_started) return;
    _started = true;

    fm.onTokenRefresh.listen((t) => Api.registerDevice(t, _lang).catchError((_) {}));

    // Foreground: show an in-app banner.
    FirebaseMessaging.onMessage.listen((m) {
      final n = m.notification;
      if (n == null) return;
      final id = m.data['bookingId'] as String?;
      messenger.currentState?.showSnackBar(SnackBar(
        content: Text('${n.title ?? ''}\n${n.body ?? ''}', style: const TextStyle(fontSize: 16)),
        duration: const Duration(seconds: 6),
        action: id == null ? null : SnackBarAction(label: '→', onPressed: () => onOpenBooking(id)),
      ));
    });

    // Tapped from the system tray.
    FirebaseMessaging.onMessageOpenedApp.listen((m) {
      final id = m.data['bookingId'] as String?;
      if (id != null) onOpenBooking(id);
    });
    final initial = await fm.getInitialMessage();
    final id = initial?.data['bookingId'] as String?;
    if (id != null) onOpenBooking(id);
  }
}
