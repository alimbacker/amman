import 'dart:async';
import 'dart:io';

import 'package:cloud_functions/cloud_functions.dart';
import 'package:firebase_auth/firebase_auth.dart';

import '../i18n_strings.dart';
import 'repo.dart';

/// Thrown with a ready-to-show, translated message.
class AppError implements Exception {
  AppError(this.code, this.message);
  final String code;
  final String message;
  @override
  String toString() => message;
}

/// Cloud Functions client — all booking writes go through the server, never directly to Firestore.
class Api {
  static final _fns = FirebaseFunctions.instanceFor(region: 'asia-south1');

  static Future<Map<String, dynamic>> _call(String name, Map<String, dynamic> data, String lang) async {
    try {
      await ensureUser();
      final res = await _fns
          .httpsCallable(name, options: HttpsCallableOptions(timeout: const Duration(seconds: 30)))
          .call<dynamic>(data);
      return Map<String, dynamic>.from(res.data as Map);
    } on FirebaseFunctionsException catch (e) {
      final details = e.details;
      final code = details is Map ? '${details['code'] ?? ''}' : '';
      final msg = kErrorMessages[code]?[lang];
      if (msg != null) throw AppError(code, msg);
      if (e.code == 'unavailable' || e.code == 'deadline-exceeded') {
        throw AppError('OFFLINE', kStrings['err_offline']![lang]!);
      }
      throw AppError('UNKNOWN', kStrings['err_generic']![lang]!);
    } on SocketException {
      throw AppError('OFFLINE', kStrings['err_offline']![lang]!);
    } on TimeoutException {
      throw AppError('OFFLINE', kStrings['err_offline']![lang]!);
    } on FirebaseAuthException catch (e) {
      final offline = e.code == 'network-request-failed';
      throw AppError(offline ? 'OFFLINE' : 'UNKNOWN', kStrings[offline ? 'err_offline' : 'err_generic']![lang]!);
    } on AppError {
      rethrow;
    } catch (_) {
      throw AppError('UNKNOWN', kStrings['err_generic']![lang]!);
    }
  }

  /// Returns {bookingId, amount, holdExpiresAt}.
  static Future<Map<String, dynamic>> createBooking(Map<String, dynamic> input, String lang) =>
      _call('createBooking', input, lang);

  static Future<void> submitPayment({
    required String bookingId,
    required String mobileNumber,
    required String transactionId,
    required double amount,
    required String lang,
  }) =>
      _call('submitPayment', {
        'bookingId': bookingId,
        'mobileNumber': mobileNumber,
        'transactionId': transactionId,
        'amount': amount,
      }, lang);

  static Future<String> lookupBooking(String bookingId, String mobile, String lang) async {
    final r = await _call('lookupBooking', {'bookingId': bookingId, 'mobileNumber': mobile}, lang);
    return '${r['bookingId']}';
  }

  static Future<void> registerDevice(String token, String lang) =>
      _call('registerDevice', {'token': token, 'lang': lang}, lang);
}
