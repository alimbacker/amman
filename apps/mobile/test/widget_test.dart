// Unit tests for the pure helpers (mirrors functions/test/logic.test.js). Run: flutter test
import 'package:flutter_test/flutter_test.dart';
import 'package:konnai_amman_ubayam/utils.dart';

void main() {
  test('mobile normalisation', () {
    expect(normalizeMobile('+91 98765-43210'), '9876543210');
    expect(normalizeMobile('09876543210'), '9876543210');
    expect(normalizeMobile('12345'), isNull);
  });
  test('transaction id', () {
    expect(normalizeTxnId(' 4123 4567 8901 '), '412345678901');
    expect(normalizeTxnId('abc'), isNull);
  });
  test('formatting', () {
    expect(formatTime('18:30', 'en'), '06:30 PM');
    expect(formatTime('06:00', 'ta'), 'காலை 6:00');
    expect(formatDate('2026-10-11', 'en', weekday: true), 'Sun, 11 Oct 2026');
    expect(formatInr(1234567), '₹12,34,567');
    expect(formatInr(501), '₹501');
  });
  test('upi link', () {
    expect(upiLink(upiId: 'a@upi', payeeName: 'Sri Temple', amount: 501, note: 'KA26-0001'),
        'upi://pay?pa=a%40upi&pn=Sri%20Temple&am=501.00&cu=INR&tn=KA26-0001');
  });
}
