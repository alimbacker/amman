// 14. Booking confirmed — ticket with booking-ID QR, Share, WhatsApp.
import 'package:flutter/material.dart';
import 'package:qr_flutter/qr_flutter.dart';
import 'package:share_plus/share_plus.dart';
import 'package:url_launcher/url_launcher.dart';

import '../models.dart';
import '../theme.dart';
import '../utils.dart';
import '../widgets/common.dart';
import 'booking_details_screen.dart';

class ConfirmationView extends StatelessWidget {
  const ConfirmationView(this.b, {super.key});
  final Booking b;

  String _shareText(BuildContext context) {
    final app = context.appRead;
    final repo = context.repoRead;
    final lang = app.lang;
    return [
      '🙏 ${repo.settings != null ? app.tr(repo.settings!.templeName) : ''}',
      '${app.t('bookingId')}: ${b.bookingId}',
      '${app.t('ubayam')}: ${app.tr(b.ubayamType)}',
      '${app.t('date')}: ${formatDate(b.date, lang, weekday: true)} · ${formatTime(b.time, lang)}',
      '${app.t('members')}: ${b.memberCount}',
      '${app.t('bookingStatus')}: ${app.t('st_${b.bookingStatus}')}',
    ].join('\n');
  }

  @override
  Widget build(BuildContext context) {
    final settings = context.repo.settings;
    return ListView(padding: const EdgeInsets.all(16), children: [
      Container(
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(26),
          border: Border.all(color: C.gold.withValues(alpha: .5), width: 2),
          boxShadow: [BoxShadow(color: C.maroon.withValues(alpha: .18), blurRadius: 30, offset: const Offset(0, 12))],
        ),
        clipBehavior: Clip.antiAlias,
        child: Column(children: [
          Container(
            width: double.infinity,
            padding: const EdgeInsets.fromLTRB(16, 22, 16, 34),
            decoration: const BoxDecoration(gradient: LinearGradient(colors: [C.maroon, C.crimson, C.maroonDeep], begin: Alignment.topLeft, end: Alignment.bottomRight)),
            child: Column(children: [
              const TempleLogo(size: 60),
              const SizedBox(height: 10),
              Text(settings != null ? context.tr(settings.templeName) : '', textAlign: TextAlign.center, style: display(20, color: C.goldLight)),
              Text(settings != null ? context.tr(settings.location) : '', style: const TextStyle(color: C.cream)),
              const SizedBox(height: 12),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                decoration: BoxDecoration(color: const Color(0xFF10B981), borderRadius: BorderRadius.circular(99)),
                child: Row(mainAxisSize: MainAxisSize.min, children: [
                  const Icon(Icons.check_circle, color: Colors.white, size: 20),
                  const SizedBox(width: 6),
                  Text(b.bookingStatus == 'completed' ? context.t('st_completed') : context.t('confirmedTitle'),
                      style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 16)),
                ]),
              ),
            ]),
          ),
          Transform.translate(
            offset: const Offset(0, -22),
            child: Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16), boxShadow: const [BoxShadow(color: Colors.black12, blurRadius: 12)]),
              child: QrImageView(data: b.bookingId, size: 150, padding: EdgeInsets.zero),
            ),
          ),
          Text(b.bookingId, style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w800, letterSpacing: 3, color: C.maroon)),
          const SizedBox(height: 8),
        ]),
      ),
      const SizedBox(height: 16),
      BookingDetailsCard(b),
      const SizedBox(height: 16),
      FilledButton.icon(
        onPressed: () => Share.share(_shareText(context), subject: '${context.appRead.t('confirmedTitle')} · ${b.bookingId}'),
        icon: const Icon(Icons.share),
        label: Text(context.t('share')),
      ),
      const SizedBox(height: 12),
      FilledButton.icon(
        style: FilledButton.styleFrom(backgroundColor: C.green),
        onPressed: () => launchUrl(Uri.parse('https://wa.me/?text=${Uri.encodeComponent(_shareText(context))}'), mode: LaunchMode.externalApplication),
        icon: const Icon(Icons.chat),
        label: Text(context.t('whatsapp')),
      ),
      if (settings != null && settings.whatsapp.isNotEmpty)
        TextButton(
          onPressed: () => launchUrl(whatsappUri(settings.whatsapp, '${b.bookingId} – '), mode: LaunchMode.externalApplication),
          child: Text(context.t('contactTemple')),
        ),
    ]);
  }
}
