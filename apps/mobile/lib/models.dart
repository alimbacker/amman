// Mirrors packages/shared/src/model.ts — keep in sync.
import 'package:cloud_firestore/cloud_firestore.dart';

class Bi {
  final String ta;
  final String en;
  const Bi(this.ta, this.en);
  static const empty = Bi('', '');

  factory Bi.from(dynamic m) {
    if (m is Map) return Bi('${m['ta'] ?? ''}', '${m['en'] ?? ''}');
    return Bi.empty;
  }

  String of(String lang) {
    final v = lang == 'ta' ? (ta.isNotEmpty ? ta : en) : (en.isNotEmpty ? en : ta);
    return v;
  }
}

int _int(dynamic v, [int d = 0]) => v is num ? v.toInt() : d;
double _num(dynamic v, [double d = 0]) => v is num ? v.toDouble() : d;
bool _bool(dynamic v, [bool d = false]) => v is bool ? v : d;
String _str(dynamic v) => v == null ? '' : '$v';
DateTime? _date(dynamic v) => v is Timestamp ? v.toDate() : null;

class FaqItem {
  final Bi q;
  final Bi a;
  const FaqItem(this.q, this.a);
}

class TempleSettings {
  final Bi templeName, location, address, about, upiInstructions;
  final String phone, whatsapp, logoUrl, heroImageUrl, upiId, upiPayeeName, upiQrUrl, currentFestivalId;
  final bool bookingOpen;
  final int holdMinutes, maxMembersPerBooking, limitedThresholdPct;
  final List<FaqItem> faq;

  TempleSettings.fromMap(Map<String, dynamic> m)
      : templeName = Bi.from(m['templeName']),
        location = Bi.from(m['location']),
        address = Bi.from(m['address']),
        about = Bi.from(m['about']),
        upiInstructions = Bi.from(m['upiInstructions']),
        phone = _str(m['phone']),
        whatsapp = _str(m['whatsapp']),
        logoUrl = _str(m['logoUrl']),
        heroImageUrl = _str(m['heroImageUrl']),
        upiId = _str(m['upiId']),
        upiPayeeName = _str(m['upiPayeeName']),
        upiQrUrl = _str(m['upiQrUrl']),
        currentFestivalId = _str(m['currentFestivalId']),
        bookingOpen = _bool(m['bookingOpen'], true),
        holdMinutes = _int(m['holdMinutes'], 30),
        maxMembersPerBooking = _int(m['maxMembersPerBooking'], 25),
        limitedThresholdPct = _int(m['limitedThresholdPct'], 25),
        faq = ((m['faq'] as List?) ?? const [])
            .whereType<Map>()
            .map((f) => FaqItem(Bi.from(f['q']), Bi.from(f['a'])))
            .toList();
}

class Festival {
  final String id, startDate, endDate;
  final Bi name, description;
  final bool active;
  Festival.fromDoc(DocumentSnapshot<Map<String, dynamic>> d)
      : id = d.id,
        name = Bi.from(d.data()?['name']),
        description = Bi.from(d.data()?['description']),
        startDate = _str(d.data()?['startDate']),
        endDate = _str(d.data()?['endDate']),
        active = _bool(d.data()?['active'], true);
}

class FestivalDay {
  final String id, festivalId, date;
  final int dayNumber;
  final Bi dayName, title, description;
  final bool active;
  FestivalDay.fromDoc(DocumentSnapshot<Map<String, dynamic>> d)
      : id = d.id,
        festivalId = _str(d.data()?['festivalId']),
        date = _str(d.data()?['date']),
        dayNumber = _int(d.data()?['dayNumber']),
        dayName = Bi.from(d.data()?['dayName']),
        title = Bi.from(d.data()?['title']),
        description = Bi.from(d.data()?['description']),
        active = _bool(d.data()?['active'], true);
}

class UbayamType {
  final String id;
  final Bi name, description;
  final double price;
  final List<String> dayIds;
  final bool allowFamily, allowGroup, active;
  final int sortOrder;
  UbayamType.fromDoc(DocumentSnapshot<Map<String, dynamic>> d)
      : id = d.id,
        name = Bi.from(d.data()?['name']),
        description = Bi.from(d.data()?['description']),
        price = _num(d.data()?['price']),
        dayIds = ((d.data()?['dayIds'] as List?) ?? const []).map((e) => '$e').toList(),
        allowFamily = _bool(d.data()?['allowFamily'], true),
        allowGroup = _bool(d.data()?['allowGroup'], true),
        active = _bool(d.data()?['active'], true),
        sortOrder = _int(d.data()?['sortOrder']);

  bool offeredOn(String dayId) => active && (dayIds.isEmpty || dayIds.contains(dayId));
}

class TimeSlot {
  final String id, dayId, date, time;
  final Bi label;
  final int capacity, bookedCount;
  final bool active;
  TimeSlot.fromDoc(DocumentSnapshot<Map<String, dynamic>> d)
      : id = d.id,
        dayId = _str(d.data()?['dayId']),
        date = _str(d.data()?['date']),
        time = _str(d.data()?['time']),
        label = Bi.from(d.data()?['label']),
        capacity = _int(d.data()?['capacity']),
        bookedCount = _int(d.data()?['bookedCount']),
        active = _bool(d.data()?['active'], true);

  int get remaining => capacity - bookedCount < 0 ? 0 : capacity - bookedCount;
}

class GroupFamily {
  final String familyName;
  final int memberCount;
  const GroupFamily(this.familyName, this.memberCount);
  Map<String, dynamic> toMap() => {'familyName': familyName, 'memberCount': memberCount};
}

class Booking {
  final String bookingId, festivalId, dayId, date, slotId, time, bookingType, ubayamTypeId;
  final Bi ubayamType;
  final String? familyName, groupName, transactionId, rejectionReason, cancelReason;
  final List<String> memberNames;
  final List<GroupFamily> families;
  final String contactName, mobileNumber, note, paymentStatus, bookingStatus;
  final int dayNumber, memberCount;
  final double amount;
  final double? amountPaid;
  final bool paymentSubmitted;
  final DateTime? holdExpiresAt, createdAt;

  Booking.fromMap(Map<String, dynamic> m)
      : bookingId = _str(m['bookingId']),
        festivalId = _str(m['festivalId']),
        dayId = _str(m['dayId']),
        date = _str(m['date']),
        slotId = _str(m['slotId']),
        time = _str(m['time']),
        bookingType = _str(m['bookingType']),
        ubayamTypeId = _str(m['ubayamTypeId']),
        ubayamType = Bi.from(m['ubayamType']),
        familyName = m['familyName'] as String?,
        groupName = m['groupName'] as String?,
        transactionId = m['transactionId'] as String?,
        rejectionReason = m['rejectionReason'] as String?,
        cancelReason = m['cancelReason'] as String?,
        memberNames = ((m['memberNames'] as List?) ?? const []).map((e) => '$e').toList(),
        families = ((m['families'] as List?) ?? const [])
            .whereType<Map>()
            .map((f) => GroupFamily('${f['familyName']}', _int(f['memberCount'])))
            .toList(),
        contactName = _str(m['contactName']),
        mobileNumber = _str(m['mobileNumber']),
        note = _str(m['note']),
        paymentStatus = _str(m['paymentStatus']),
        bookingStatus = _str(m['bookingStatus']),
        dayNumber = _int(m['dayNumber']),
        memberCount = _int(m['memberCount']),
        amount = _num(m['amount']),
        amountPaid = m['amountPaid'] is num ? (m['amountPaid'] as num).toDouble() : null,
        paymentSubmitted = _bool(m['paymentSubmitted']),
        holdExpiresAt = _date(m['holdExpiresAt']),
        createdAt = _date(m['createdAt']);

  bool get isFamily => bookingType == 'family';
  String get whoName => (isFamily ? familyName : groupName) ?? '';

  /// awaiting_payment | verifying | paid | rejected
  String get paymentStage {
    if (paymentStatus == 'paid') return 'paid';
    if (paymentStatus == 'rejected') return 'rejected';
    return paymentSubmitted ? 'verifying' : 'awaiting_payment';
  }

  /// upcoming | completed | cancelled
  String get bucket => bookingStatus == 'cancelled'
      ? 'cancelled'
      : bookingStatus == 'completed'
          ? 'completed'
          : 'upcoming';
}
