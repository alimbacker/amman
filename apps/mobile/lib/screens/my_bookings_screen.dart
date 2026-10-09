// 15. My bookings — upcoming / completed / cancelled, plus "find booking" by ID + mobile.
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';

import '../models.dart';
import '../services/api.dart';
import '../services/repo.dart';
import '../theme.dart';
import '../utils.dart';
import '../widgets/common.dart';
import 'booking_details_screen.dart';

class MyBookingsScreen extends StatelessWidget {
  const MyBookingsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return StreamBuilder<User?>(
      stream: FirebaseAuth.instance.authStateChanges(),
      builder: (context, auth) {
        final user = auth.data;
        if (user == null) {
          if (auth.connectionState == ConnectionState.active) ensureUser().ignore();
          return const Padding(padding: EdgeInsets.all(16), child: Column(children: [Skeleton(), Skeleton()]));
        }
        return _MyList(key: ValueKey(user.uid), uid: user.uid);
      },
    );
  }
}

/// Holds one Firestore listener per signed-in identity (not re-created on every rebuild).
class _MyList extends StatefulWidget {
  const _MyList({super.key, required this.uid});
  final String uid;
  @override
  State<_MyList> createState() => _MyListState();
}

class _MyListState extends State<_MyList> {
  late final Stream<List<Booking>> _stream = TempleRepo.myBookings(widget.uid);
  @override
  Widget build(BuildContext context) => StreamBuilder<List<Booking>>(
        stream: _stream,
        builder: (context, snap) => _Tabs(items: snap.data, loading: !snap.hasData && !snap.hasError),
      );
}

class _Tabs extends StatelessWidget {
  const _Tabs({required this.items, required this.loading});
  final List<Booking>? items;
  final bool loading;

  @override
  Widget build(BuildContext context) {
    final all = items ?? const <Booking>[];
    const buckets = ['upcoming', 'completed', 'cancelled'];
    return DefaultTabController(
      length: 3,
      child: Column(children: [
        Container(
          color: Colors.white,
          child: TabBar(
            labelColor: C.crimson,
            unselectedLabelColor: C.inkSoft,
            indicatorColor: C.crimson,
            labelStyle: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
            tabs: [for (final k in buckets) Tab(text: '${context.t(k)} (${all.where((b) => b.bucket == k).length})')],
          ),
        ),
        Expanded(
          child: TabBarView(children: [
            for (final k in buckets)
              ListView(padding: const EdgeInsets.all(16), children: [
                if (loading) ...const [Skeleton(height: 120), Skeleton(height: 120)],
                if (!loading && all.where((b) => b.bucket == k).isEmpty)
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 32),
                    child: Column(children: [
                      const Icon(Icons.confirmation_number_outlined, size: 48, color: C.gold),
                      const SizedBox(height: 8),
                      Text(context.t('noBookings'), style: const TextStyle(color: C.inkSoft)),
                    ]),
                  ),
                for (final b in all.where((b) => b.bucket == k)) _BookingCard(b),
                const SizedBox(height: 8),
                if (k == 'upcoming') const _FindBooking(),
              ]),
          ]),
        ),
      ]),
    );
  }
}

class _BookingCard extends StatelessWidget {
  const _BookingCard(this.b);
  final Booking b;
  @override
  Widget build(BuildContext context) {
    final lang = context.lang;
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Card(
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => BookingDetailsScreen(bookingId: b.bookingId))),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [
                Expanded(child: Text(b.bookingId, style: const TextStyle(color: C.crimson, fontWeight: FontWeight.w800, letterSpacing: 1))),
                Text(formatInr(b.amount), style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 17)),
              ]),
              Text(context.tr(b.ubayamType), style: display(18)),
              Text('${formatDate(b.date, lang, weekday: true)} · ${formatTime(b.time, lang)}', style: const TextStyle(color: C.inkSoft)),
              Text('${b.whoName} · ${b.memberCount} ${context.t('members')}', style: const TextStyle(color: C.inkSoft)),
              const SizedBox(height: 10),
              Wrap(spacing: 8, runSpacing: 6, children: [BookingPill(b), PaymentPill(b)]),
            ]),
          ),
        ),
      ),
    );
  }
}

class _FindBooking extends StatefulWidget {
  const _FindBooking();
  @override
  State<_FindBooking> createState() => _FindBookingState();
}

class _FindBookingState extends State<_FindBooking> {
  final id = TextEditingController();
  final mobile = TextEditingController();
  String? error;
  bool busy = false;

  @override
  void dispose() {
    id.dispose();
    mobile.dispose();
    super.dispose();
  }

  Future<void> _find() async {
    final app = context.appRead;
    if (id.text.trim().isEmpty) return setState(() => error = app.t('err_required'));
    if (normalizeMobile(mobile.text) == null) return setState(() => error = app.t('err_mobile'));
    setState(() {
      busy = true;
      error = null;
    });
    try {
      final bookingId = await Api.lookupBooking(id.text.trim().toUpperCase(), mobile.text, app.lang);
      if (!mounted) return;
      setState(() => busy = false);
      Navigator.of(context).push(MaterialPageRoute(builder: (_) => BookingDetailsScreen(bookingId: bookingId)));
    } on AppError catch (e) {
      if (mounted) {
        setState(() {
          busy = false;
          error = e.message;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Row(children: [const Icon(Icons.search, color: C.maroon), const SizedBox(width: 6), Text(context.t('findBooking'), style: display(18))]),
          const SizedBox(height: 4),
          Text(context.t('findBookingHelp'), style: const TextStyle(color: C.inkSoft)),
          const SizedBox(height: 12),
          TextField(controller: id, textCapitalization: TextCapitalization.characters, decoration: InputDecoration(labelText: context.t('bookingId'), hintText: 'KA26-0001')),
          const SizedBox(height: 12),
          TextField(controller: mobile, keyboardType: TextInputType.phone, decoration: InputDecoration(labelText: context.t('mobileNumber'), prefixText: '+91 ')),
          const SizedBox(height: 12),
          ErrorBox(error),
          FilledButton(onPressed: busy ? null : _find, child: busy ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2.5, color: Colors.white)) : Text(context.t('find'))),
        ]),
      ),
    );
  }
}
