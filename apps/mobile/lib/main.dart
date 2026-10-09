import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'app_state.dart';
import 'firebase_options.dart';
import 'screens/booking_details_screen.dart';
import 'screens/start_screens.dart';
import 'services/push.dart';
import 'services/repo.dart';
import 'theme.dart';

final navigatorKey = GlobalKey<NavigatorState>();
final messengerKey = GlobalKey<ScaffoldMessengerState>();

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);
  final app = await AppState.load();
  ensureUser().ignore(); // warm up the anonymous session in the background
  runApp(
    MultiProvider(
      providers: [
        ChangeNotifierProvider.value(value: app),
        ChangeNotifierProvider(create: (_) => TempleRepo()),
      ],
      child: const TempleApp(),
    ),
  );
}

class TempleApp extends StatefulWidget {
  const TempleApp({super.key});
  @override
  State<TempleApp> createState() => _TempleAppState();
}

class _TempleAppState extends State<TempleApp> {
  String? _pushLang;

  void _openBooking(String id) {
    navigatorKey.currentState?.push(MaterialPageRoute(builder: (_) => BookingDetailsScreen(bookingId: id)));
  }

  @override
  Widget build(BuildContext context) {
    final app = context.watch<AppState>();
    // (Re)register for push in the chosen language once it is known.
    if (app.langChosen && _pushLang != app.lang) {
      _pushLang = app.lang;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        Push.init(lang: app.lang, messenger: messengerKey, onOpenBooking: _openBooking);
      });
    }
    return MaterialApp(
      title: app.lang == 'ta' ? 'கொன்னை அம்மன் உபயம்' : 'Konnai Amman Ubayam',
      debugShowCheckedModeBanner: false,
      navigatorKey: navigatorKey,
      scaffoldMessengerKey: messengerKey,
      theme: buildTheme(),
      builder: (context, child) {
        // Elderly-friendly: honour the in-app text size on top of the system setting (capped).
        final mq = MediaQuery.of(context);
        final double system = mq.textScaler.scale(1).clamp(1.0, 1.3).toDouble();
        return MediaQuery(
          data: mq.copyWith(textScaler: TextScaler.linear(system * app.textScale)),
          child: child!,
        );
      },
      home: const SplashScreen(),
    );
  }
}
