// 1. Splash and 2. Language selection.
import 'package:flutter/material.dart';

import '../theme.dart';
import '../widgets/common.dart';
import 'shell.dart';

class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});
  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> {
  @override
  void initState() {
    super.initState();
    Future.delayed(const Duration(milliseconds: 1200), () {
      if (!mounted) return;
      final next = context.appRead.langChosen ? const HomeShell() : const LanguageScreen();
      Navigator.of(context).pushReplacement(PageRouteBuilder(
        pageBuilder: (_, __, ___) => next,
        transitionsBuilder: (_, a, __, child) => FadeTransition(opacity: a, child: child),
      ));
    });
  }

  @override
  Widget build(BuildContext context) {
    final s = context.repo.settings;
    return Scaffold(
      body: _MaroonBackdrop(
        child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
          const TempleLogo(size: 110),
          const SizedBox(height: 22),
          Text(s?.templeName.ta ?? 'ஸ்ரீ கொன்னை அம்மன் ஆலயம்', textAlign: TextAlign.center, style: display(28, color: C.goldLight)),
          const SizedBox(height: 4),
          Text(s?.templeName.en ?? 'Sri Konnai Amman Temple', style: const TextStyle(color: C.cream, fontSize: 18)),
          const SizedBox(height: 4),
          Text(s?.location.ta ?? 'கார்காத்தி', style: const TextStyle(color: C.cream, fontSize: 15)),
          const SizedBox(height: 28),
          const SizedBox(width: 28, height: 28, child: CircularProgressIndicator(strokeWidth: 3, color: C.goldLight)),
        ]),
      ),
    );
  }
}

class LanguageScreen extends StatelessWidget {
  const LanguageScreen({super.key});
  @override
  Widget build(BuildContext context) {
    void choose(String l) {
      context.appRead.setLang(l);
      Navigator.of(context).pushReplacement(MaterialPageRoute(builder: (_) => const HomeShell()));
    }

    return Scaffold(
      body: _MaroonBackdrop(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 28),
          child: Column(mainAxisAlignment: MainAxisAlignment.center, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            const Center(child: TempleLogo(size: 90)),
            const SizedBox(height: 18),
            Text('ஸ்ரீ கொன்னை அம்மன் ஆலயம்', textAlign: TextAlign.center, style: display(26, color: C.goldLight)),
            const SizedBox(height: 26),
            const Center(child: OrnamentRule(width: 150)),
            const SizedBox(height: 26),
            const Text('உங்கள் மொழியைத் தேர்ந்தெடுக்கவும்', textAlign: TextAlign.center, style: TextStyle(color: C.cream, fontSize: 19)),
            const Text('Choose your language', textAlign: TextAlign.center, style: TextStyle(color: Color(0xCCFFF8EC), fontSize: 16)),
            const SizedBox(height: 22),
            GoldButton(label: 'தமிழ்', onPressed: () => choose('ta')),
            const SizedBox(height: 14),
            OutlinedButton(
              style: OutlinedButton.styleFrom(foregroundColor: C.cream, side: const BorderSide(color: C.goldLight, width: 2), minimumSize: const Size.fromHeight(60)),
              onPressed: () => choose('en'),
              child: const Text('English', style: TextStyle(fontSize: 20)),
            ),
          ]),
        ),
      ),
    );
  }
}

class _MaroonBackdrop extends StatelessWidget {
  const _MaroonBackdrop({required this.child});
  final Widget child;
  @override
  Widget build(BuildContext context) => Container(
        width: double.infinity,
        decoration: const BoxDecoration(
          gradient: LinearGradient(colors: [C.maroon, C.maroonDark, C.maroonDeep], begin: Alignment.topCenter, end: Alignment.bottomCenter),
        ),
        child: SafeArea(child: child),
      );
}
