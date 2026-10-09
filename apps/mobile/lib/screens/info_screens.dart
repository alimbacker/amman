// 4. Temple information · 5. Navaratri days · 17. Help/FAQ · 18. Settings
import 'package:flutter/material.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:url_launcher/url_launcher.dart';

import '../theme.dart';
import '../utils.dart';
import '../widgets/common.dart';
import 'booking_steps.dart';
import 'home_screen.dart';

class TempleInfoScreen extends StatelessWidget {
  const TempleInfoScreen({super.key});
  @override
  Widget build(BuildContext context) {
    final s = context.repo.settings;
    return Scaffold(
      appBar: AppBar(title: Text(context.t('templeInfo'))),
      body: s == null
          ? const Padding(padding: EdgeInsets.all(16), child: Skeleton(height: 300))
          : ListView(padding: const EdgeInsets.all(16), children: [
              if (s.heroImageUrl.isNotEmpty)
                ClipRRect(borderRadius: BorderRadius.circular(20), child: AspectRatio(aspectRatio: 16 / 9, child: Image.network(s.heroImageUrl, fit: BoxFit.cover))),
              const SizedBox(height: 16),
              Row(children: [
                const TempleLogo(size: 60),
                const SizedBox(width: 14),
                Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(s.templeName.ta, style: display(22)),
                  Text(s.templeName.en, style: const TextStyle(color: C.inkSoft)),
                ])),
              ]),
              const SizedBox(height: 16),
              Text(context.tr(s.about), style: const TextStyle(fontSize: 17.5, height: 1.6)),
              const SizedBox(height: 20),
              ContactCard(),
              const SizedBox(height: 16),
              GoldButton(label: context.t('bookUbayam'), icon: Icons.event_available, onPressed: () => DateSelectionScreen.start(context)),
            ]),
    );
  }
}

class ContactCard extends StatelessWidget {
  const ContactCard({super.key});
  @override
  Widget build(BuildContext context) {
    final s = context.repo.settings;
    if (s == null) return const SizedBox.shrink();
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Text(context.t('contactTemple'), style: display(19)),
          const SizedBox(height: 6),
          Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            const Icon(Icons.place_outlined, color: C.crimson),
            const SizedBox(width: 6),
            Expanded(child: Text(context.tr(s.address), style: const TextStyle(color: C.inkSoft))),
          ]),
          const SizedBox(height: 12),
          if (s.whatsapp.isNotEmpty)
            FilledButton.icon(
              style: FilledButton.styleFrom(backgroundColor: C.green),
              onPressed: () => launchUrl(whatsappUri(s.whatsapp, context.appRead.tr(s.templeName)), mode: LaunchMode.externalApplication),
              icon: const Icon(Icons.chat),
              label: Text(context.t('whatsapp')),
            ),
          if (s.phone.isNotEmpty) ...[
            const SizedBox(height: 10),
            OutlinedButton.icon(
              onPressed: () => launchUrl(Uri(scheme: 'tel', path: s.phone.replaceAll(' ', ''))),
              icon: const Icon(Icons.call),
              label: Text(s.phone),
            ),
          ],
        ]),
      ),
    );
  }
}

class DaysScreen extends StatelessWidget {
  const DaysScreen({super.key});
  @override
  Widget build(BuildContext context) {
    final repo = context.repo;
    final today = todayIst();
    return ListView(padding: const EdgeInsets.all(16), children: [
      SectionTitle(context.t('navaratriDays'), sub: repo.festival != null ? context.tr(repo.festival!.name) : null),
      if (!repo.ready && repo.days.isEmpty) ...List.generate(4, (_) => const Skeleton()),
      for (final d in repo.activeDays) DayTile(day: d, past: d.date.compareTo(today) < 0, showDescription: true),
      if (repo.ready && repo.activeDays.isEmpty) Text(context.t('noFestival')),
    ]);
  }
}

class HelpScreen extends StatelessWidget {
  const HelpScreen({super.key});
  @override
  Widget build(BuildContext context) {
    final s = context.repo.settings;
    return ListView(padding: const EdgeInsets.all(16), children: [
      SectionTitle(context.t('help')),
      if (s == null) const Skeleton(height: 200),
      if (s != null)
        for (final f in s.faq)
          Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: Card(
              clipBehavior: Clip.antiAlias,
              child: ExpansionTile(
                shape: const Border(),
                title: Text(context.tr(f.q), style: const TextStyle(fontWeight: FontWeight.w700, color: C.maroon, fontSize: 17)),
                childrenPadding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                expandedAlignment: Alignment.centerLeft,
                children: [Text(context.tr(f.a), style: const TextStyle(fontSize: 16.5, color: C.inkSoft))],
              ),
            ),
          ),
      const SizedBox(height: 8),
      const ContactCard(),
    ]);
  }
}

class SettingsScreen extends StatelessWidget {
  const SettingsScreen({super.key});
  @override
  Widget build(BuildContext context) {
    final app = context.app;
    Widget choice(String label, bool selected, VoidCallback onTap, {double size = 17}) => Expanded(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 4),
            child: OutlinedButton(
              style: OutlinedButton.styleFrom(
                backgroundColor: selected ? C.saffronPale : Colors.white,
                foregroundColor: selected ? C.crimson : C.ink,
                side: BorderSide(color: selected ? C.crimson : C.gold.withValues(alpha: .4), width: 2),
                padding: const EdgeInsets.symmetric(horizontal: 4),
              ),
              onPressed: onTap,
              child: Text(label, style: TextStyle(fontSize: size), textAlign: TextAlign.center),
            ),
          ),
        );
    return Scaffold(
      appBar: AppBar(title: Text(context.t('settings'))),
      body: ListView(padding: const EdgeInsets.all(16), children: [
        Text(context.t('language'), style: display(19)),
        const SizedBox(height: 10),
        Row(children: [
          choice('தமிழ்', app.lang == 'ta', () => context.appRead.setLang('ta')),
          choice('English', app.lang == 'en', () => context.appRead.setLang('en')),
        ]),
        const SizedBox(height: 24),
        Text(context.t('textSize'), style: display(19)),
        const SizedBox(height: 10),
        Row(children: [
          choice(context.t('normal'), app.textScale == 1.0, () => context.appRead.setTextScale(1.0), size: 15),
          choice(context.t('large'), app.textScale == 1.15, () => context.appRead.setTextScale(1.15), size: 17),
          choice(context.t('extraLarge'), app.textScale == 1.3, () => context.appRead.setTextScale(1.3), size: 19),
        ]),
        const SizedBox(height: 32),
        OutlinedButton(
          onPressed: () async {
            final messenger = ScaffoldMessenger.of(context);
            final done = context.appRead.t('st_completed');
            await FirebaseAuth.instance.signOut(); // a new anonymous identity is created on next use
            messenger.showSnackBar(SnackBar(content: Text(done)));
          },
          child: Text(context.t('clearDevice'), textAlign: TextAlign.center),
        ),
      ]),
    );
  }
}
