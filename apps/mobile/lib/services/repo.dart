import 'dart:async';

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/foundation.dart';

import '../models.dart';

/// Live public configuration for the current festival (one listener per collection, ≈40 docs).
/// Firestore's offline cache on Android/iOS makes repeat launches instant and survives poor networks.
class TempleRepo extends ChangeNotifier {
  TempleRepo() {
    _subs.add(_db.doc('settings/public').snapshots().listen(_onSettings, onError: _onError));
  }

  final _db = FirebaseFirestore.instance;
  final List<StreamSubscription> _subs = [];
  final List<StreamSubscription> _festSubs = [];

  TempleSettings? settings;
  Festival? festival;
  List<FestivalDay> days = [];
  List<TimeSlot> slots = [];
  List<UbayamType> ubayams = [];
  bool ready = false;
  bool error = false;
  String _fid = '';

  void _onError(Object _) {
    ready = true;
    error = settings == null;
    notifyListeners();
  }

  void _onSettings(DocumentSnapshot<Map<String, dynamic>> snap) {
    if (!snap.exists && snap.metadata.isFromCache) return; // unknown, not deleted
    settings = snap.exists ? TempleSettings.fromMap(snap.data()!) : null;
    ready = true;
    error = false;
    final fid = settings?.currentFestivalId ?? '';
    if (fid != _fid) {
      _fid = fid;
      for (final s in _festSubs) {
        s.cancel();
      }
      _festSubs.clear();
      if (fid.isNotEmpty) _listenFestival(fid);
    }
    notifyListeners();
  }

  void _listenFestival(String fid) {
    _festSubs.add(_db.doc('festivals/$fid').snapshots().listen((d) {
      festival = d.exists ? Festival.fromDoc(d) : null;
      notifyListeners();
    }, onError: _onError));
    Query<Map<String, dynamic>> q(String c) => _db.collection(c).where('festivalId', isEqualTo: fid);
    _festSubs.add(q('festivalDays').snapshots().listen((s) {
      if (s.docs.isEmpty && s.metadata.isFromCache) return;
      days = s.docs.map(FestivalDay.fromDoc).toList()..sort((a, b) => a.dayNumber.compareTo(b.dayNumber));
      notifyListeners();
    }, onError: _onError));
    _festSubs.add(q('timeSlots').snapshots().listen((s) {
      if (s.docs.isEmpty && s.metadata.isFromCache) return;
      slots = s.docs.map(TimeSlot.fromDoc).toList()..sort((a, b) => a.time.compareTo(b.time));
      notifyListeners();
    }, onError: _onError));
    _festSubs.add(q('ubayamTypes').snapshots().listen((s) {
      if (s.docs.isEmpty && s.metadata.isFromCache) return;
      ubayams = s.docs.map(UbayamType.fromDoc).toList()..sort((a, b) => a.sortOrder.compareTo(b.sortOrder));
      notifyListeners();
    }, onError: _onError));
  }

  List<FestivalDay> get activeDays => days.where((d) => d.active).toList();
  List<TimeSlot> slotsForDay(String dayId) => slots.where((s) => s.dayId == dayId && s.active).toList();
  List<UbayamType> ubayamsForDay(String dayId) => ubayams.where((u) => u.offeredOn(dayId)).toList();
  bool get bookingOpen => (settings?.bookingOpen ?? false) && (festival?.active ?? false);
  int get limitedPct => settings?.limitedThresholdPct ?? 25;

  FestivalDay? dayById(String id) {
    for (final d in days) {
      if (d.id == id) return d;
    }
    return null;
  }

  /// Bookings visible to this device (it created them, or proved ownership via lookup).
  static Stream<List<Booking>> myBookings(String uid) => FirebaseFirestore.instance
      .collection('bookings')
      .where('viewerUids', arrayContains: uid)
      .orderBy('createdAt', descending: true)
      .snapshots()
      .map((s) => s.docs.map((d) => Booking.fromMap(d.data())).toList());

  static Stream<Booking?> booking(String id) => FirebaseFirestore.instance
      .doc('bookings/$id')
      .snapshots()
      .map((d) => d.exists ? Booking.fromMap(d.data()!) : null);

  @override
  void dispose() {
    for (final s in [..._subs, ..._festSubs]) {
      s.cancel();
    }
    super.dispose();
  }
}

/// Devotees never sign up — each install gets a silent anonymous identity.
Future<User> ensureUser() async {
  final auth = FirebaseAuth.instance;
  return auth.currentUser ?? (await auth.signInAnonymously()).user!;
}
