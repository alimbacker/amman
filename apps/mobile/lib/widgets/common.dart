import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../app_state.dart';
import '../models.dart';
import '../services/repo.dart';
import '../theme.dart';
import '../utils.dart';

extension Ctx on BuildContext {
  AppState get app => watch<AppState>();
  AppState get appRead => read<AppState>();
  TempleRepo get repo => watch<TempleRepo>();
  TempleRepo get repoRead => read<TempleRepo>();
  String t(String key, [Map<String, Object> vars = const {}]) => watch<AppState>().t(key, vars);
  String tr(Bi b) => watch<AppState>().tr(b);
  String get lang => watch<AppState>().lang;
}

/// Temple mark: uploaded logo, or a lamp icon.
class TempleLogo extends StatelessWidget {
  const TempleLogo({super.key, this.size = 44});
  final double size;
  @override
  Widget build(BuildContext context) {
    final url = context.repo.settings?.logoUrl ?? '';
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(shape: BoxShape.circle, color: C.cream, border: Border.all(color: C.gold, width: 2)),
      clipBehavior: Clip.antiAlias,
      child: url.isNotEmpty
          ? Image.network(url, fit: BoxFit.cover, errorBuilder: (_, __, ___) => _lamp())
          : _lamp(),
    );
  }

  Widget _lamp() => Icon(Icons.local_fire_department_rounded, color: C.saffron, size: size * .58);
}

class OrnamentRule extends StatelessWidget {
  const OrnamentRule({super.key, this.width = 110});
  final double width;
  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: width,
      height: 10,
      child: Row(
        children: List.generate(
          (width / 18).floor(),
          (i) => Expanded(child: Row(children: [
            Expanded(child: Container(height: 1, color: C.gold.withValues(alpha: .7))),
            Container(width: 5, height: 5, decoration: const BoxDecoration(color: C.gold, shape: BoxShape.circle)),
            Expanded(child: Container(height: 1, color: C.gold.withValues(alpha: .7))),
          ])),
        ),
      ),
    );
  }
}

class SectionTitle extends StatelessWidget {
  const SectionTitle(this.text, {super.key, this.sub});
  final String text;
  final String? sub;
  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(text, style: display(22)),
        if (sub != null && sub!.isNotEmpty) Padding(padding: const EdgeInsets.only(top: 2), child: Text(sub!, style: const TextStyle(color: C.inkSoft))),
        const SizedBox(height: 8),
        const OrnamentRule(),
      ]),
    );
  }
}

class Pill extends StatelessWidget {
  const Pill(this.text, {super.key, required this.color});
  final String text;
  final Color color;
  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(color: color.withValues(alpha: .12), borderRadius: BorderRadius.circular(99), border: Border.all(color: color.withValues(alpha: .35))),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        Container(width: 8, height: 8, decoration: BoxDecoration(color: color, shape: BoxShape.circle)),
        const SizedBox(width: 6),
        Text(text, style: TextStyle(color: Color.lerp(color, Colors.black, .35), fontWeight: FontWeight.w700, fontSize: 14)),
      ]),
    );
  }
}

const _green = Color(0xFF10B981), _amber = Color(0xFFF59E0B), _red = Color(0xFFEF4444), _gray = Color(0xFF9CA3AF), _blue = Color(0xFF0EA5E9);

class SlotPill extends StatelessWidget {
  const SlotPill(this.state, {super.key});
  final SlotState state;
  @override
  Widget build(BuildContext context) {
    switch (state) {
      case SlotState.available:
        return Pill(context.t('available'), color: _green);
      case SlotState.limited:
        return Pill(context.t('limited'), color: _amber);
      case SlotState.full:
        return Pill(context.t('full'), color: _red);
      case SlotState.closed:
        return Pill(context.t('closed'), color: _gray);
    }
  }
}

class PaymentPill extends StatelessWidget {
  const PaymentPill(this.b, {super.key});
  final Booking b;
  @override
  Widget build(BuildContext context) {
    final st = b.paymentStage;
    final color = {'awaiting_payment': _amber, 'verifying': _blue, 'paid': _green, 'rejected': _red}[st]!;
    return Pill(context.t('st_$st'), color: color);
  }
}

class BookingPill extends StatelessWidget {
  const BookingPill(this.b, {super.key});
  final Booking b;
  @override
  Widget build(BuildContext context) {
    final color = {'pending': _amber, 'confirmed': _green, 'cancelled': _gray, 'completed': _blue}[b.bookingStatus] ?? _gray;
    return Pill(context.t('st_${b.bookingStatus}'), color: color);
  }
}

class DetailRow extends StatelessWidget {
  const DetailRow(this.label, this.value, {super.key, this.child});
  final String label;
  final String value;
  final Widget? child;
  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 10),
      decoration: BoxDecoration(border: Border(bottom: BorderSide(color: C.gold.withValues(alpha: .2)))),
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Expanded(flex: 4, child: Text(label, style: const TextStyle(color: C.inkSoft, fontSize: 16))),
        const SizedBox(width: 12),
        Expanded(flex: 6, child: Align(alignment: Alignment.centerRight, child: child ?? Text(value, textAlign: TextAlign.right, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16.5)))),
      ]),
    );
  }
}

class DayBadge extends StatelessWidget {
  const DayBadge(this.n, {super.key, this.size = 48});
  final int n;
  final double size;
  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        gradient: const LinearGradient(colors: [C.goldLight, C.gold], begin: Alignment.topLeft, end: Alignment.bottomRight),
        border: Border.all(color: C.goldPale, width: 4),
      ),
      child: Text('$n', style: display(size * .42, color: C.maroonDeep)),
    );
  }
}

/// Large tappable card used for choices in the booking flow.
class ChoiceCard extends StatelessWidget {
  const ChoiceCard({super.key, required this.child, required this.onTap, this.selected = false, this.enabled = true});
  final Widget child;
  final VoidCallback onTap;
  final bool selected;
  final bool enabled;
  @override
  Widget build(BuildContext context) {
    return Opacity(
      opacity: enabled ? 1 : .5,
      child: Material(
        color: Colors.white,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(20),
          side: BorderSide(color: selected ? C.crimson : C.gold.withValues(alpha: .3), width: selected ? 2.5 : 1.5),
        ),
        clipBehavior: Clip.antiAlias,
        child: InkWell(onTap: enabled ? onTap : null, child: Padding(padding: const EdgeInsets.all(16), child: child)),
      ),
    );
  }
}

class Skeleton extends StatelessWidget {
  const Skeleton({super.key, this.height = 90});
  final double height;
  @override
  Widget build(BuildContext context) => Container(
        height: height,
        margin: const EdgeInsets.only(bottom: 12),
        decoration: BoxDecoration(color: C.goldPale.withValues(alpha: .6), borderRadius: BorderRadius.circular(18)),
      );
}

class ErrorBox extends StatelessWidget {
  const ErrorBox(this.message, {super.key});
  final String? message;
  @override
  Widget build(BuildContext context) {
    if (message == null || message!.isEmpty) return const SizedBox.shrink();
    return Container(
      padding: const EdgeInsets.all(14),
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(color: const Color(0xFFFEF2F2), borderRadius: BorderRadius.circular(14), border: Border.all(color: const Color(0xFFFECACA))),
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        const Icon(Icons.error_outline, color: Color(0xFF991B1B)),
        const SizedBox(width: 10),
        Expanded(child: Text(message!, style: const TextStyle(color: Color(0xFF7F1D1D), fontWeight: FontWeight.w600, fontSize: 16))),
      ]),
    );
  }
}

class GoldButton extends StatelessWidget {
  const GoldButton({super.key, required this.label, required this.onPressed, this.icon, this.busy = false});
  final String label;
  final VoidCallback? onPressed;
  final IconData? icon;
  final bool busy;
  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        gradient: const LinearGradient(colors: [C.goldLight, C.gold], begin: Alignment.topCenter, end: Alignment.bottomCenter),
        borderRadius: BorderRadius.circular(16),
        boxShadow: [BoxShadow(color: C.maroon.withValues(alpha: .25), blurRadius: 16, offset: const Offset(0, 6))],
      ),
      child: FilledButton(
        style: FilledButton.styleFrom(backgroundColor: Colors.transparent, foregroundColor: C.maroonDeep, shadowColor: Colors.transparent, minimumSize: const Size.fromHeight(60)),
        onPressed: busy ? null : onPressed,
        child: busy
            ? const SizedBox(width: 24, height: 24, child: CircularProgressIndicator(strokeWidth: 3, color: C.maroon))
            : Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                if (icon != null) ...[Icon(icon), const SizedBox(width: 8)],
                Flexible(child: Text(label, textAlign: TextAlign.center)),
              ]),
      ),
    );
  }
}

/// Number stepper with large +/- buttons.
class Stepper2 extends StatelessWidget {
  const Stepper2({super.key, required this.value, required this.max, required this.onChanged});
  final int value;
  final int max;
  final ValueChanged<int> onChanged;
  @override
  Widget build(BuildContext context) {
    Widget btn(IconData i, VoidCallback? f) => SizedBox(
          width: 56,
          height: 56,
          child: OutlinedButton(style: OutlinedButton.styleFrom(padding: EdgeInsets.zero, minimumSize: const Size(56, 56)), onPressed: f, child: Icon(i, size: 26)),
        );
    return Row(mainAxisSize: MainAxisSize.min, children: [
      btn(Icons.remove, value > 1 ? () => onChanged(value - 1) : null),
      SizedBox(width: 64, child: Text('$value', textAlign: TextAlign.center, style: display(24, color: C.ink))),
      btn(Icons.add, value < max ? () => onChanged(value + 1) : null),
    ]);
  }
}
