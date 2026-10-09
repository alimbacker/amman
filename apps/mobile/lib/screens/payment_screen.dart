// 12. UPI QR payment — Scan & Pay, "Pay using UPI", "I Have Paid" → UTR + amount → submit.
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:qr_flutter/qr_flutter.dart';
import 'package:url_launcher/url_launcher.dart';

import '../models.dart';
import '../services/api.dart';
import '../theme.dart';
import '../utils.dart';
import '../widgets/common.dart';
import 'booking_details_screen.dart';

class PaymentView extends StatefulWidget {
  const PaymentView(this.b, {super.key});
  final Booking b;
  @override
  State<PaymentView> createState() => _PaymentViewState();
}

class _PaymentViewState extends State<PaymentView> {
  bool confirming = false;
  bool busy = false;
  String? error;
  final txn = TextEditingController();
  late final amount = TextEditingController(text: widget.b.amount.round().toString());
  Timer? _tick;

  @override
  void initState() {
    super.initState();
    _tick = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted && widget.b.holdExpiresAt != null) setState(() {});
    });
  }

  @override
  void dispose() {
    _tick?.cancel();
    txn.dispose();
    amount.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final app = context.appRead;
    if (normalizeTxnId(txn.text) == null) {
      setState(() => error = app.t('err_txn'));
      return;
    }
    setState(() {
      busy = true;
      error = null;
    });
    try {
      await Api.submitPayment(
        bookingId: widget.b.bookingId,
        mobileNumber: widget.b.mobileNumber,
        transactionId: txn.text,
        amount: double.tryParse(amount.text.trim()) ?? 0,
        lang: app.lang,
      );
      // The live booking stream switches this page to "Payment submitted".
    } on AppError catch (e) {
      if (mounted) {
        setState(() {
          busy = false;
          error = e.message;
        });
      }
    }
  }

  String _left(DateTime until) {
    final d = until.difference(DateTime.now());
    if (d.isNegative) return '00:00';
    final h = d.inHours, m = d.inMinutes % 60, s = d.inSeconds % 60;
    return '${h > 0 ? '$h:' : ''}${m.toString().padLeft(2, '0')}:${s.toString().padLeft(2, '0')}';
  }

  @override
  Widget build(BuildContext context) {
    final b = widget.b;
    final s = context.repo.settings;
    final upi = (s != null && s.upiId.isNotEmpty)
        ? upiLink(upiId: s.upiId, payeeName: s.upiPayeeName.isNotEmpty ? s.upiPayeeName : s.templeName.en, amount: b.amount, note: b.bookingId)
        : null;

    return ListView(padding: const EdgeInsets.all(16), children: [
      SectionTitle(context.t('scanPay')),
      if (b.paymentStatus == 'rejected')
        Container(
          margin: const EdgeInsets.only(bottom: 12),
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(color: const Color(0xFFFEF2F2), borderRadius: BorderRadius.circular(14), border: Border.all(color: const Color(0xFFFECACA))),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(context.t('st_rejected'), style: const TextStyle(fontWeight: FontWeight.w800, color: Color(0xFF7F1D1D))),
            if (b.rejectionReason != null) Text('${context.t('rejectedReason')}: ${b.rejectionReason}'),
            Text(context.t('resubmitPayment')),
          ]),
        ),
      if (b.holdExpiresAt != null)
        Container(
          margin: const EdgeInsets.only(bottom: 12),
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          decoration: BoxDecoration(color: C.saffronPale, borderRadius: BorderRadius.circular(14)),
          child: Row(children: [
            const Icon(Icons.timer_outlined, color: C.maroon),
            const SizedBox(width: 8),
            Text(_left(b.holdExpiresAt!), style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 18, color: C.maroon, fontFeatures: [FontFeature.tabularFigures()])),
            const SizedBox(width: 8),
            Expanded(child: Text(context.t('holdNotice', {'m': s?.holdMinutes ?? 30}).split('.').first, style: const TextStyle(color: C.inkSoft, fontSize: 14))),
          ]),
        ),
      Card(
        clipBehavior: Clip.antiAlias,
        child: Column(children: [
          Container(
            padding: const EdgeInsets.all(16),
            decoration: const BoxDecoration(gradient: LinearGradient(colors: [C.maroon, C.crimson])),
            child: Row(children: [
              Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(context.t('amountToPay'), style: const TextStyle(color: C.cream)),
                Text(formatInr(b.amount), style: display(32, color: C.goldLight)),
              ])),
              Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text(context.t('bookingId'), style: const TextStyle(color: C.cream, fontSize: 13)),
                Text(b.bookingId, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 18, letterSpacing: 1)),
              ]),
            ]),
          ),
          Padding(
            padding: const EdgeInsets.all(16),
            child: confirming ? _confirmForm(context) : _qr(context, s, upi),
          ),
        ]),
      ),
      const SizedBox(height: 16),
      BookingDetailsCard(b),
    ]);
  }

  Widget _qr(BuildContext context, TempleSettings? s, String? upi) {
    return Column(children: [
      Container(
        padding: const EdgeInsets.all(10),
        decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(18), border: Border.all(color: C.goldLight, width: 4)),
        child: SizedBox(
          width: 240,
          height: 240,
          child: (s?.upiQrUrl.isNotEmpty ?? false)
              ? Image.network(s!.upiQrUrl, fit: BoxFit.contain)
              : upi != null
                  ? QrImageView(data: upi, size: 240, padding: EdgeInsets.zero)
                  : const Skeleton(height: 240),
        ),
      ),
      const SizedBox(height: 12),
      Text(context.t('payTo'), style: const TextStyle(color: C.inkSoft)),
      Text(s?.upiPayeeName ?? '', style: display(18), textAlign: TextAlign.center),
      if (s != null && s.upiId.isNotEmpty)
        TextButton.icon(
          onPressed: () {
            Clipboard.setData(ClipboardData(text: s.upiId));
            ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(context.appRead.t('copied'))));
          },
          icon: const Icon(Icons.copy, size: 18),
          label: Text(s.upiId, style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w700)),
        ),
      const SizedBox(height: 8),
      if (upi != null)
        OutlinedButton.icon(
          onPressed: () async {
            final ok = await launchUrl(Uri.parse(upi), mode: LaunchMode.externalApplication);
            if (!ok && context.mounted) {
              ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(context.appRead.t('err_generic'))));
            }
          },
          icon: const Icon(Icons.account_balance_wallet_outlined),
          label: Text(context.t('payUsingUpi')),
        ),
      const SizedBox(height: 12),
      GoldButton(label: context.t('iHavePaid'), icon: Icons.check_circle_outline, onPressed: () => setState(() => confirming = true)),
      if (s != null && context.tr(s.upiInstructions).isNotEmpty)
        Container(
          margin: const EdgeInsets.only(top: 16),
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(color: C.creamDeep, borderRadius: BorderRadius.circular(14)),
          child: Text(context.tr(s.upiInstructions), style: const TextStyle(color: C.inkSoft, fontSize: 16)),
        ),
    ]);
  }

  Widget _confirmForm(BuildContext context) {
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      TextField(
        controller: txn,
        textCapitalization: TextCapitalization.characters,
        style: const TextStyle(fontSize: 20, letterSpacing: 1.5, fontWeight: FontWeight.w700),
        decoration: InputDecoration(labelText: context.t('txnId'), hintText: '412345678901', helperText: context.t('txnHelp'), helperMaxLines: 3),
      ),
      const SizedBox(height: 14),
      TextField(
        controller: amount,
        keyboardType: const TextInputType.numberWithOptions(decimal: true),
        style: const TextStyle(fontSize: 19),
        decoration: InputDecoration(labelText: context.t('amountPaid'), prefixText: '₹ '),
      ),
      const SizedBox(height: 14),
      ErrorBox(error),
      FilledButton.icon(onPressed: busy ? null : _submit, icon: busy ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2.5, color: Colors.white)) : const Icon(Icons.send), label: Text(context.t('submitBooking'))),
      const SizedBox(height: 8),
      TextButton(onPressed: () => setState(() => confirming = false), child: Text(context.t('back'))),
    ]);
  }
}
