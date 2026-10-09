// 16. Booking details — live; shows Payment (12), Submitted (13), Confirmation (14) or Cancelled
// depending on the booking's state, so a devotee always lands on the right step.
import 'dart:async';

import 'package:flutter/material.dart';

import '../models.dart';
import '../services/repo.dart';
import '../theme.dart';
import '../utils.dart';
import '../widgets/common.dart';
import 'confirmation_screen.dart';
import 'payment_screen.dart';
import 'payment_submitted_screen.dart';

class BookingDetailsScreen extends StatefulWidget {
  const BookingDetailsScreen({super.key, required this.bookingId});
  final String bookingId;
  @override
  State<BookingDetailsScreen> createState() => _BookingDetailsScreenState();
}

class _BookingDetailsScreenState extends State<BookingDetailsScreen> {
  StreamSubscription<Booking?>? _sub;
  Booking? _b;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    ensureUser().then((_) {
      if (!mounted) return;
      _sub = TempleRepo.booking(widget.bookingId).listen(
        (b) => setState(() {
          _b = b;
          _loading = false;
        }),
        onError: (_) => setState(() => _loading = false),
      );
    }).catchError((_) {
      if (mounted) setState(() => _loading = false);
    });
  }

  @override
  void dispose() {
    _sub?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final b = _b;
    Widget body;
    if (_loading) {
      body = ListView(padding: const EdgeInsets.all(16), children: const [Skeleton(height: 120), Skeleton(height: 300)]);
    } else if (b == null) {
      body = Center(child: Padding(padding: const EdgeInsets.all(24), child: Text(context.t('err_generic'), textAlign: TextAlign.center)));
    } else if (b.bookingStatus == 'cancelled') {
      body = _Cancelled(b);
    } else if (b.bookingStatus == 'confirmed' || b.bookingStatus == 'completed') {
      body = ConfirmationView(b);
    } else if (b.paymentStage == 'verifying') {
      body = PaymentSubmittedView(b);
    } else {
      body = PaymentView(b);
    }
    return Scaffold(
      appBar: AppBar(title: Text(b?.bookingId ?? context.t('viewBooking'))),
      body: SafeArea(child: body),
    );
  }
}

/// Full detail list shared by the payment / submitted / confirmed views.
class BookingDetailsCard extends StatelessWidget {
  const BookingDetailsCard(this.b, {super.key});
  final Booking b;
  @override
  Widget build(BuildContext context) {
    final lang = context.lang;
    return Card(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
        child: Column(children: [
          DetailRow(context.t('bookingId'), b.bookingId),
          DetailRow(context.t('customerName'), b.contactName),
          DetailRow(context.t('familyOrGroup'), '${b.whoName} (${context.t(b.isFamily ? 'family' : 'group')})'),
          DetailRow(context.t('date'), formatDate(b.date, lang, weekday: true)),
          DetailRow(context.t('time'), formatTime(b.time, lang)),
          DetailRow(context.t('ubayam'), context.tr(b.ubayamType)),
          DetailRow(context.t('members'), '${b.memberCount}'),
          if (!b.isFamily && b.families.isNotEmpty)
            DetailRow(context.t('families'), b.families.map((f) => '${f.familyName} – ${f.memberCount}').join('\n')),
          DetailRow(context.t('amount'), formatInr(b.amount)),
          DetailRow(context.t('paymentStatus'), '', child: PaymentPill(b)),
          DetailRow(context.t('bookingStatus'), '', child: BookingPill(b)),
          if (b.transactionId != null) DetailRow(context.t('txnId'), b.transactionId!),
        ]),
      ),
    );
  }
}

class _Cancelled extends StatelessWidget {
  const _Cancelled(this.b);
  final Booking b;
  @override
  Widget build(BuildContext context) {
    return ListView(padding: const EdgeInsets.all(16), children: [
      const SizedBox(height: 12),
      const Icon(Icons.cancel_outlined, size: 64, color: C.inkMute),
      const SizedBox(height: 8),
      Text(context.t('st_cancelled'), textAlign: TextAlign.center, style: display(26)),
      if (b.cancelReason != null) Text('${context.t('rejectedReason')}: ${b.cancelReason}', textAlign: TextAlign.center, style: const TextStyle(color: C.inkSoft)),
      const SizedBox(height: 16),
      BookingDetailsCard(b),
    ]);
  }
}
