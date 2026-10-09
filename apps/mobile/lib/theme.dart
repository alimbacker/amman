import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

class C {
  static const maroon = Color(0xFF6B0F1A);
  static const maroonDark = Color(0xFF480912);
  static const maroonDeep = Color(0xFF33060C);
  static const crimson = Color(0xFF9E1B1B);
  static const gold = Color(0xFFC9962B);
  static const goldLight = Color(0xFFE8C468);
  static const goldPale = Color(0xFFF7E7BE);
  static const goldDark = Color(0xFF9A7020);
  static const cream = Color(0xFFFFF8EC);
  static const creamDeep = Color(0xFFFBEFD9);
  static const saffron = Color(0xFFF08A24);
  static const saffronPale = Color(0xFFFFF1E0);
  static const ink = Color(0xFF2B1A14);
  static const inkSoft = Color(0xFF5C4A40);
  static const inkMute = Color(0xFF8A776B);
  static const green = Color(0xFF1F9D55);
}

/// Serif display face for headings (Tamil-capable).
TextStyle display(double size, {Color color = C.maroon, FontWeight weight = FontWeight.w700}) =>
    GoogleFonts.notoSerifTamil(fontSize: size, color: color, fontWeight: weight, height: 1.25);

ThemeData buildTheme() {
  final base = ThemeData(
    useMaterial3: true,
    colorScheme: ColorScheme.fromSeed(seedColor: C.maroon, primary: C.crimson, secondary: C.gold, surface: Colors.white),
    scaffoldBackgroundColor: C.cream,
  );
  final text = GoogleFonts.muktaMalarTextTheme(base.textTheme).apply(bodyColor: C.ink, displayColor: C.maroon);
  final btnShape = RoundedRectangleBorder(borderRadius: BorderRadius.circular(16));
  return base.copyWith(
    textTheme: text.copyWith(
      bodyLarge: text.bodyLarge?.copyWith(fontSize: 18),
      bodyMedium: text.bodyMedium?.copyWith(fontSize: 16.5),
    ),
    appBarTheme: AppBarTheme(
      backgroundColor: C.maroon,
      foregroundColor: C.cream,
      centerTitle: false,
      titleTextStyle: display(19, color: C.goldLight),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: C.crimson,
        foregroundColor: Colors.white,
        minimumSize: const Size.fromHeight(58),
        shape: btnShape,
        textStyle: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: C.maroon,
        minimumSize: const Size.fromHeight(56),
        side: BorderSide(color: C.maroon.withValues(alpha: .3), width: 2),
        shape: btnShape,
        textStyle: const TextStyle(fontSize: 17, fontWeight: FontWeight.w600),
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: Colors.white,
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
      border: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: BorderSide(color: C.gold.withValues(alpha: .4), width: 2)),
      enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: BorderSide(color: C.gold.withValues(alpha: .4), width: 2)),
      focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: const BorderSide(color: C.gold, width: 2.5)),
      labelStyle: const TextStyle(fontSize: 17, color: C.inkSoft),
    ),
    cardTheme: CardThemeData(
      color: Colors.white,
      elevation: 0,
      margin: EdgeInsets.zero,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20), side: BorderSide(color: C.gold.withValues(alpha: .25))),
    ),
    navigationBarTheme: NavigationBarThemeData(
      backgroundColor: Colors.white,
      indicatorColor: C.saffronPale,
      height: 72,
      labelTextStyle: WidgetStateProperty.all(const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600)),
    ),
  );
}
