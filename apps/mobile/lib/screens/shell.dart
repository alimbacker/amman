import 'package:flutter/material.dart';

import '../theme.dart';
import '../widgets/common.dart';
import 'home_screen.dart';
import 'info_screens.dart';
import 'my_bookings_screen.dart';

/// Bottom-navigation shell: Home · Navaratri days · My bookings · Help.
class HomeShell extends StatefulWidget {
  const HomeShell({super.key});
  @override
  State<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends State<HomeShell> {
  int index = 0;

  @override
  Widget build(BuildContext context) {
    final s = context.repo.settings;
    final pages = [
      HomeScreen(onTab: (i) => setState(() => index = i)),
      const DaysScreen(),
      const MyBookingsScreen(),
      const HelpScreen(),
    ];
    return Scaffold(
      appBar: AppBar(
        titleSpacing: 12,
        title: Row(children: [
          const TempleLogo(size: 38),
          const SizedBox(width: 10),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(s != null ? context.tr(s.templeName) : '', overflow: TextOverflow.ellipsis, style: display(17, color: C.goldLight)),
              Text(s != null ? context.tr(s.location) : '', style: const TextStyle(fontSize: 13, color: Color(0xCCFFF8EC))),
            ]),
          ),
        ]),
        actions: [
          const _LangToggle(),
          IconButton(
            tooltip: context.t('settings'),
            icon: const Icon(Icons.settings_outlined),
            onPressed: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const SettingsScreen())),
          ),
        ],
        bottom: const PreferredSize(
          preferredSize: Size.fromHeight(3),
          child: DecoratedBox(
            decoration: BoxDecoration(gradient: LinearGradient(colors: [C.goldDark, C.goldLight, C.goldDark])),
            child: SizedBox(height: 3, width: double.infinity),
          ),
        ),
      ),
      body: IndexedStack(index: index, children: pages),
      bottomNavigationBar: NavigationBar(
        selectedIndex: index,
        onDestinationSelected: (i) => setState(() => index = i),
        destinations: [
          NavigationDestination(icon: const Icon(Icons.home_outlined), selectedIcon: const Icon(Icons.home, color: C.crimson), label: context.t('home')),
          NavigationDestination(icon: const Icon(Icons.calendar_month_outlined), selectedIcon: const Icon(Icons.calendar_month, color: C.crimson), label: context.t('stepDay')),
          NavigationDestination(icon: const Icon(Icons.confirmation_number_outlined), selectedIcon: const Icon(Icons.confirmation_number, color: C.crimson), label: context.t('myBookings')),
          NavigationDestination(icon: const Icon(Icons.help_outline), selectedIcon: const Icon(Icons.help, color: C.crimson), label: context.t('navHelp')),
        ],
      ),
    );
  }
}

class _LangToggle extends StatelessWidget {
  const _LangToggle();
  @override
  Widget build(BuildContext context) {
    final lang = context.lang;
    Widget opt(String l, String label) => GestureDetector(
          onTap: () => context.appRead.setLang(l),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
            decoration: BoxDecoration(color: lang == l ? C.goldLight : Colors.transparent, borderRadius: BorderRadius.circular(99)),
            child: Text(label, style: TextStyle(fontWeight: FontWeight.w700, color: lang == l ? C.maroonDeep : C.cream)),
          ),
        );
    return Container(
      padding: const EdgeInsets.all(2),
      decoration: BoxDecoration(borderRadius: BorderRadius.circular(99), border: Border.all(color: C.gold.withValues(alpha: .6))),
      child: Row(mainAxisSize: MainAxisSize.min, children: [opt('ta', 'தமிழ்'), opt('en', 'EN')]),
    );
  }
}
