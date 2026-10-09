// 13. Payment submitted — waiting for the temple to verify the UTR.
import 'package:flutter/material.dart';

import '../models.dart';
import '../theme.dart';
import '../widgets/common.dart';
import 'booking_details_screen.dart';

class PaymentSubmittedView extends StatelessWidget {
  const PaymentSubmittedView(this.b, {super.key});
  final Booking b;
  @override
  Widget build(BuildContext context) {
    return ListView(padding: const EdgeInsets.all(16), children: [
      const SizedBox(height: 12),
      Center(
        child: Container(
          width: 88,
          height: 88,
          decoration: const BoxDecoration(color: Color(0xFFE0F2FE), shape: BoxShape.circle),
          child: const Icon(Icons.hourglass_top_rounded, size: 44, color: Color(0xFF0369A1)),
        ),
      ),
      const SizedBox(height: 12),
      Text(context.t('submittedTitle'), textAlign: TextAlign.center, style: display(26)),
      const SizedBox(height: 6),
      Text(context.t('submittedBody'), textAlign: TextAlign.center, style: const TextStyle(fontSize: 17, color: C.inkSoft)),
      const SizedBox(height: 18),
      BookingDetailsCard(b),
      const SizedBox(height: 14),
      Text(context.t('saveBookingId'), textAlign: TextAlign.center, style: const TextStyle(fontWeight: FontWeight.w700, color: C.maroon)),
      const SizedBox(height: 14),
      OutlinedButton(onPressed: () => Navigator.of(context).popUntil((r) => r.isFirst), child: Text(context.t('home'))),
    ]);
  }
}
