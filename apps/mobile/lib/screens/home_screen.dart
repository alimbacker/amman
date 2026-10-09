// 3. Home
import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../models.dart';
import '../theme.dart';
import '../utils.dart';
import '../widgets/common.dart';
import 'booking_steps.dart';
import 'info_screens.dart';

class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key, required this.onTab});
  final ValueChanged<int> onTab;

  @override
  Widget build(BuildContext context) {
    final repo = context.repo;
    final s = repo.settings;
    final f = repo.festival;
    final lang = context.lang;
    final today = todayIst();

    if (repo.ready && repo.error) {
      return Center(child: Padding(padding: const EdgeInsets.all(24), child: Text(context.t('err_offline'), textAlign: TextAlign.center)));
    }

    return ListView(padding: EdgeInsets.zero, children: [
      // Hero
      Container(
        decoration: BoxDecoration(
          gradient: const LinearGradient(colors: [C.maroon, C.crimson, C.maroonDeep], begin: Alignment.topLeft, end: Alignment.bottomRight),
          image: (s?.heroImageUrl.isNotEmpty ?? false)
              ? DecorationImage(image: NetworkImage(s!.heroImageUrl), fit: BoxFit.cover, opacity: .28)
              : null,
        ),
        padding: const EdgeInsets.fromLTRB(20, 24, 20, 26),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          if (s == null) const Skeleton(height: 80) else ...[
            Text(s.templeName.ta, style: display(30, color: C.goldLight)),
            Text(s.templeName.en, style: const TextStyle(color: C.cream, fontSize: 18)),
            const SizedBox(height: 8),
            Row(children: [
              const Icon(Icons.place_outlined, color: C.cream, size: 18),
              const SizedBox(width: 4),
              Text(context.tr(s.location), style: const TextStyle(color: C.cream)),
            ]),
          ],
          if (f != null) ...[
            const SizedBox(height: 16),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(color: Colors.black.withValues(alpha: .18), borderRadius: BorderRadius.circular(16), border: Border.all(color: C.gold.withValues(alpha: .5))),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(context.t('appTagline'), style: const TextStyle(color: C.goldLight, fontWeight: FontWeight.w700, fontSize: 13)),
                Text(context.tr(f.name), style: display(21, color: C.cream)),
                Text('${formatDate(f.startDate, lang, year: false)} – ${formatDate(f.endDate, lang)}', style: const TextStyle(color: C.cream)),
              ]),
            ),
          ],
          const SizedBox(height: 18),
          if (repo.bookingOpen || !repo.ready)
            GoldButton(label: context.t('bookUbayam'), icon: Icons.event_available, onPressed: () => DateSelectionScreen.start(context))
          else
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(color: Colors.white.withValues(alpha: .1), borderRadius: BorderRadius.circular(14)),
              child: Text(context.t('bookingClosed'), style: const TextStyle(color: C.goldLight, fontWeight: FontWeight.w700)),
            ),
          const SizedBox(height: 12),
          OutlinedButton.icon(
            style: OutlinedButton.styleFrom(foregroundColor: C.cream, side: BorderSide(color: C.goldLight.withValues(alpha: .7), width: 2)),
            onPressed: () => onTab(2),
            icon: const Icon(Icons.confirmation_number_outlined),
            label: Text(context.t('myBookings')),
          ),
        ]),
      ),

      Padding(
        padding: const EdgeInsets.fromLTRB(16, 18, 16, 0),
        child: Row(children: [
          Expanded(child: _Tile(icon: Icons.account_balance_outlined, label: context.t('templeInfo'), onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const TempleInfoScreen())))),
          const SizedBox(width: 12),
          Expanded(child: _Tile(
            icon: Icons.chat_outlined,
            label: context.t('contactTemple'),
            onTap: s == null || s.whatsapp.isEmpty
                ? () => onTab(3)
                : () => launchUrl(whatsappUri(s.whatsapp, context.appRead.tr(s.templeName)), mode: LaunchMode.externalApplication),
          )),
        ]),
      ),

      if (f != null)
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 18, 16, 0),
          child: Card(
            child: Padding(
              padding: const EdgeInsets.all(18),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(context.t('nineDays'), style: display(20)),
                const SizedBox(height: 6),
                Text(context.tr(f.description), style: const TextStyle(fontSize: 16.5, color: C.inkSoft)),
              ]),
            ),
          ),
        ),

      Padding(
        padding: const EdgeInsets.fromLTRB(16, 22, 16, 24),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          SectionTitle(context.t('navaratriDays')),
          if (!repo.ready && repo.days.isEmpty) ...List.generate(3, (_) => const Skeleton()),
          for (final d in repo.activeDays) DayTile(day: d, past: d.date.compareTo(today) < 0),
          if (repo.ready && repo.activeDays.isEmpty) Text(context.t('noFestival')),
        ]),
      ),
    ]);
  }
}

class _Tile extends StatelessWidget {
  const _Tile({required this.icon, required this.label, required this.onTap});
  final IconData icon;
  final String label;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) => Card(
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Icon(icon, color: C.crimson, size: 28),
              const SizedBox(height: 6),
              Text(label, style: const TextStyle(fontWeight: FontWeight.w700, color: C.maroon, fontSize: 16)),
            ]),
          ),
        ),
      );
}

/// One Navaratri day with availability, tapping starts booking for it.
class DayTile extends StatelessWidget {
  const DayTile({super.key, required this.day, this.past = false, this.showDescription = false});
  final FestivalDay day;
  final bool past;
  final bool showDescription;
  @override
  Widget build(BuildContext context) {
    final lang = context.lang;
    final slots = context.repo.slotsForDay(day.id);
    final rem = slots.fold<int>(0, (s, x) => s + x.remaining);
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Opacity(
        opacity: past ? .55 : 1,
        child: Card(
          clipBehavior: Clip.antiAlias,
          child: InkWell(
            onTap: past || !context.repo.bookingOpen ? null : () => DateSelectionScreen.start(context, day: day),
            child: Padding(
              padding: const EdgeInsets.all(14),
              child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                DayBadge(day.dayNumber),
                const SizedBox(width: 14),
                Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text('${context.tr(day.dayName)} · ${formatDate(day.date, lang, weekday: true, year: false)}', style: const TextStyle(color: C.crimson, fontWeight: FontWeight.w700, fontSize: 15)),
                  Text(context.tr(day.title), style: display(17)),
                  if (showDescription && context.tr(day.description).isNotEmpty)
                    Padding(padding: const EdgeInsets.only(top: 4), child: Text(context.tr(day.description), style: const TextStyle(color: C.inkSoft))),
                  const SizedBox(height: 8),
                  if (!past)
                    Wrap(spacing: 12, runSpacing: 6, crossAxisAlignment: WrapCrossAlignment.center, alignment: WrapAlignment.spaceBetween, children: [
                      slots.isEmpty
                          ? const SlotPill(SlotState.closed)
                          : rem == 0
                              ? const SlotPill(SlotState.full)
                              : Pill('${context.t('remaining')}: $rem', color: const Color(0xFF10B981)),
                      Text('${context.t('bookUbayam')} ›', style: const TextStyle(color: C.crimson, fontWeight: FontWeight.w700)),
                    ]),
                ])),
              ]),
            ),
          ),
        ),
      ),
    );
  }
}
