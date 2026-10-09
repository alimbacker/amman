import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'i18n_strings.dart';
import 'models.dart';

/// Language + text size preferences (Tamil is primary).
class AppState extends ChangeNotifier {
  AppState(this._prefs)
      : lang = _prefs.getString('lang') ?? 'ta',
        langChosen = _prefs.getString('lang') != null,
        textScale = _prefs.getDouble('textScale') ?? 1.0;

  final SharedPreferences _prefs;
  String lang;
  bool langChosen;
  double textScale; // 1.0 / 1.15 / 1.3

  static Future<AppState> load() async => AppState(await SharedPreferences.getInstance());

  void setLang(String l) {
    lang = l;
    langChosen = true;
    _prefs.setString('lang', l);
    notifyListeners();
  }

  void setTextScale(double s) {
    textScale = s;
    _prefs.setDouble('textScale', s);
    notifyListeners();
  }

  /// Translate a key from the shared dictionary, with {var} substitution.
  String t(String key, [Map<String, Object> vars = const {}]) {
    var s = kStrings[key]?[lang] ?? key;
    vars.forEach((k, v) => s = s.replaceAll('{$k}', '$v'));
    return s;
  }

  String tr(Bi b) => b.of(lang);
}
