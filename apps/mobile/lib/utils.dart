// Mirrors packages/shared/src/utils.ts — keep in sync.
import 'dart:math' as math;

import 'models.dart';

enum SlotState { available, limited, full, closed }

SlotState slotState(TimeSlot s, int limitedPct) {
  if (!s.active) return SlotState.closed;
  final remaining = s.remaining;
  if (remaining <= 0) return SlotState.full;
  final threshold = math.max(1, ((s.capacity * limitedPct) / 100).ceil());
  return remaining <= threshold ? SlotState.limited : SlotState.available;
}

String? normalizeMobile(String input) {
  var d = input.replaceAll(RegExp(r'\D'), '');
  if (d.length == 12 && d.startsWith('91')) d = d.substring(2);
  if (d.length == 11 && d.startsWith('0')) d = d.substring(1);
  return RegExp(r'^[6-9]\d{9}$').hasMatch(d) ? d : null;
}

String? normalizeTxnId(String input) {
  final t = input.replaceAll(RegExp(r'[\s-]'), '').toUpperCase();
  return RegExp(r'^[A-Z0-9]{6,35}$').hasMatch(t) ? t : null;
}

String formatInr(num n) {
  final s = n.round().toString();
  if (s.length <= 3) return '₹$s';
  // Indian grouping: 12,34,567
  final last3 = s.substring(s.length - 3);
  var rest = s.substring(0, s.length - 3);
  final parts = <String>[];
  while (rest.length > 2) {
    parts.insert(0, rest.substring(rest.length - 2));
    rest = rest.substring(0, rest.length - 2);
  }
  if (rest.isNotEmpty) parts.insert(0, rest);
  return '₹${parts.join(',')},$last3';
}

String formatTime(String hhmm, String lang) {
  final p = hhmm.split(':');
  final h = int.tryParse(p.isNotEmpty ? p[0] : '0') ?? 0;
  final m = (int.tryParse(p.length > 1 ? p[1] : '0') ?? 0).toString().padLeft(2, '0');
  final h12 = h % 12 == 0 ? 12 : h % 12;
  if (lang == 'ta') {
    final part = h < 12 ? 'காலை' : h < 16 ? 'மதியம்' : h < 19 ? 'மாலை' : 'இரவு';
    return '$part $h12:$m';
  }
  return '${h12.toString().padLeft(2, '0')}:$m ${h < 12 ? 'AM' : 'PM'}';
}

const _taMonths = ['ஜனவரி', 'பிப்ரவரி', 'மார்ச்', 'ஏப்ரல்', 'மே', 'ஜூன்', 'ஜூலை', 'ஆகஸ்ட்', 'செப்டம்பர்', 'அக்டோபர்', 'நவம்பர்', 'டிசம்பர்'];
const _taWeek = ['திங்கள்', 'செவ்வாய்', 'புதன்', 'வியாழன்', 'வெள்ளி', 'சனி', 'ஞாயிறு'];
const _enMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const _enWeek = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/// "2026-10-11" → "ஞாயிறு, 11 அக்டோபர் 2026" / "Sun, 11 Oct 2026"
String formatDate(String ymd, String lang, {bool weekday = false, bool year = true}) {
  final p = ymd.split('-');
  if (p.length != 3) return ymd;
  final y = int.tryParse(p[0]), mo = int.tryParse(p[1]), d = int.tryParse(p[2]);
  if (y == null || mo == null || d == null) return ymd;
  final wd = DateTime.utc(y, mo, d).weekday - 1; // Mon=0
  final yr = year ? ' $y' : '';
  if (lang == 'ta') return '${weekday ? '${_taWeek[wd]}, ' : ''}$d ${_taMonths[mo - 1]}$yr';
  return '${weekday ? '${_enWeek[wd]}, ' : ''}$d ${_enMonths[mo - 1]}$yr';
}

/// Today's date in India (temple time), as YYYY-MM-DD.
String todayIst() {
  final now = DateTime.now().toUtc().add(const Duration(hours: 5, minutes: 30));
  return '${now.year.toString().padLeft(4, '0')}-${now.month.toString().padLeft(2, '0')}-${now.day.toString().padLeft(2, '0')}';
}

String upiLink({required String upiId, required String payeeName, required num amount, required String note}) {
  // Encoded by hand: spaces must be %20 (not '+') for some UPI apps.
  final q = {'pa': upiId, 'pn': payeeName, 'am': amount.toStringAsFixed(2), 'cu': 'INR', 'tn': note}
      .entries
      .map((e) => '${e.key}=${Uri.encodeComponent(e.value)}')
      .join('&');
  return 'upi://pay?$q';
}

Uri whatsappUri(String number, String text) =>
    Uri.parse('https://wa.me/${number.replaceAll(RegExp(r'\D'), '')}?text=${Uri.encodeComponent(text)}');
