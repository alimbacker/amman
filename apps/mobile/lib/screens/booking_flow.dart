import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../models.dart';
import '../theme.dart';
import '../widgets/common.dart';

/// State carried through: day → time → ubayam → family/group → details → summary.
class BookingDraft extends ChangeNotifier {
  FestivalDay? day;
  TimeSlot? slot;
  UbayamType? ubayam;
  String bookingType = 'family';
  String contactName = '';
  String mobile = '';
  String familyName = '';
  int memberCount = 1;
  String memberNames = '';
  String groupName = '';
  List<GroupFamily> families = const [GroupFamily('', 1), GroupFamily('', 1)];
  String note = '';

  int get totalMembers => bookingType == 'group' ? families.fold(0, (s, f) => s + f.memberCount) : memberCount;

  void update(VoidCallback f) {
    f();
    notifyListeners();
  }

  Map<String, dynamic> toInput() => {
        'slotId': slot!.id,
        'ubayamTypeId': ubayam!.id,
        'bookingType': bookingType,
        'contactName': contactName.trim(),
        'mobileNumber': mobile,
        'note': note.trim(),
        if (bookingType == 'family') ...{
          'familyName': familyName.trim(),
          'memberCount': memberCount,
          'memberNames': memberNames.split('\n').map((s) => s.trim()).where((s) => s.isNotEmpty).toList(),
        } else ...{
          'groupName': groupName.trim(),
          'families': families.map((f) => GroupFamily(f.familyName.trim(), f.memberCount).toMap()).toList(),
        },
      };
}

/// Pushes the next step, keeping the same draft in scope.
Future<T?> pushFlow<T>(BuildContext context, Widget screen) {
  final draft = context.read<BookingDraft>();
  return Navigator.of(context).push<T>(MaterialPageRoute(
    builder: (_) => ChangeNotifierProvider.value(value: draft, child: screen),
  ));
}

const _steps = ['stepDay', 'stepTime', 'stepUbayam', 'stepType', 'stepDetails', 'stepSummary'];

/// Scaffold with the step progress bar used by every booking step.
class FlowScaffold extends StatelessWidget {
  const FlowScaffold({super.key, required this.step, required this.title, required this.children, this.bottom, this.sub});
  final int step;
  final String title;
  final String? sub;
  final List<Widget> children;
  final Widget? bottom;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(context.t('bookUbayam'))),
      body: SafeArea(
        child: Column(children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: List.generate(_steps.length, (i) => Expanded(
                    child: Container(
                      height: 6,
                      margin: const EdgeInsets.symmetric(horizontal: 2),
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(9),
                        gradient: i <= step ? const LinearGradient(colors: [C.gold, C.crimson]) : null,
                        color: i <= step ? null : C.gold.withValues(alpha: .2),
                      ),
                    ),
                  ))),
              const SizedBox(height: 6),
              Text('${step + 1}/${_steps.length} · ${context.t(_steps[step])}', style: const TextStyle(color: C.crimson, fontWeight: FontWeight.w700)),
            ]),
          ),
          Expanded(
            child: ListView(padding: const EdgeInsets.fromLTRB(16, 12, 16, 24), children: [
              SectionTitle(title, sub: sub),
              ...children,
            ]),
          ),
          if (bottom != null)
            Container(
              padding: const EdgeInsets.fromLTRB(16, 10, 16, 14),
              decoration: BoxDecoration(color: Colors.white, border: Border(top: BorderSide(color: C.gold.withValues(alpha: .25)))),
              child: bottom,
            ),
        ]),
      ),
    );
  }
}
