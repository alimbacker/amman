// Booking flow screens 6–11: Date → Time slot → Ubayam → Family/Group → Family/Group details → Summary.
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../models.dart';
import '../services/api.dart';
import '../theme.dart';
import '../utils.dart';
import '../widgets/common.dart';
import 'booking_details_screen.dart';
import 'booking_flow.dart';

/* ---------------- 6. Date selection ---------------- */

class DateSelectionScreen extends StatelessWidget {
  const DateSelectionScreen({super.key});

  /// Entry point: starts a fresh draft, optionally with a preselected day.
  static Future<void> start(BuildContext context, {FestivalDay? day}) {
    final draft = BookingDraft()..day = day;
    return Navigator.of(context).push(MaterialPageRoute(
      builder: (_) => ChangeNotifierProvider.value(value: draft, child: day == null ? const DateSelectionScreen() : const TimeSlotScreen()),
    ));
  }

  @override
  Widget build(BuildContext context) {
    final repo = context.repo;
    final lang = context.lang;
    final today = todayIst();
    if (!repo.bookingOpen && repo.ready) {
      return FlowScaffold(step: 0, title: context.t('bookingClosed'), children: const []);
    }
    return FlowScaffold(
      step: 0,
      title: context.t('selectDay'),
      children: [
        if (!repo.ready && repo.days.isEmpty) ...List.generate(4, (_) => const Skeleton()),
        for (final d in repo.activeDays)
          Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: ChoiceCard(
              enabled: d.date.compareTo(today) >= 0,
              selected: context.watch<BookingDraft>().day?.id == d.id,
              onTap: () {
                context.read<BookingDraft>().update(() {
                  final draft = context.read<BookingDraft>();
                  draft.day = d;
                  draft.slot = null;
                  draft.ubayam = null;
                });
                pushFlow(context, const TimeSlotScreen());
              },
              child: Row(children: [
                DayBadge(d.dayNumber),
                const SizedBox(width: 14),
                Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text('${context.tr(d.dayName)} · ${formatDate(d.date, lang, weekday: true, year: false)}', style: const TextStyle(color: C.crimson, fontWeight: FontWeight.w700)),
                  Text(context.tr(d.title), style: display(17)),
                  const SizedBox(height: 6),
                  _DayRemaining(d.id),
                ])),
                const Icon(Icons.chevron_right, color: C.inkMute),
              ]),
            ),
          ),
      ],
    );
  }
}

class _DayRemaining extends StatelessWidget {
  const _DayRemaining(this.dayId);
  final String dayId;
  @override
  Widget build(BuildContext context) {
    final slots = context.repo.slotsForDay(dayId);
    final rem = slots.fold<int>(0, (s, x) => s + x.remaining);
    if (slots.isEmpty) return const SlotPill(SlotState.closed);
    if (rem == 0) return const SlotPill(SlotState.full);
    return Pill('${context.t('remaining')}: $rem', color: const Color(0xFF10B981));
  }
}

/* ---------------- 7. Time slot ---------------- */

class TimeSlotScreen extends StatelessWidget {
  const TimeSlotScreen({super.key});
  @override
  Widget build(BuildContext context) {
    final draft = context.watch<BookingDraft>();
    final repo = context.repo;
    final lang = context.lang;
    final day = draft.day!;
    final slots = repo.slotsForDay(day.id);
    return FlowScaffold(
      step: 1,
      title: context.t('selectTime'),
      sub: '${context.tr(day.dayName)} · ${formatDate(day.date, lang, weekday: true)}',
      children: [
        if (slots.isEmpty) Card(child: Padding(padding: const EdgeInsets.all(24), child: Text(context.t('noSlots'), textAlign: TextAlign.center))),
        for (final s in slots)
          Builder(builder: (context) {
            final st = slotState(s, repo.limitedPct);
            return Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: ChoiceCard(
                enabled: st == SlotState.available || st == SlotState.limited,
                selected: draft.slot?.id == s.id,
                onTap: () {
                  draft.update(() {
                    draft.slot = s;
                    draft.ubayam = null;
                  });
                  pushFlow(context, const UbayamScreen());
                },
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Row(children: [
                    const Icon(Icons.schedule, color: C.goldDark),
                    const SizedBox(width: 8),
                    Expanded(child: Text(formatTime(s.time, lang), style: display(23))),
                    SlotPill(st),
                  ]),
                  if (context.tr(s.label).isNotEmpty) Text(context.tr(s.label), style: const TextStyle(color: C.inkSoft)),
                  const SizedBox(height: 10),
                  Container(
                    padding: const EdgeInsets.symmetric(vertical: 8),
                    decoration: BoxDecoration(color: C.creamDeep, borderRadius: BorderRadius.circular(12)),
                    child: Row(children: [
                      _Count(context.t('capacity'), s.capacity, C.ink),
                      _Count(context.t('booked'), s.bookedCount, C.ink),
                      _Count(context.t('remaining'), s.remaining, C.crimson),
                    ]),
                  ),
                ]),
              ),
            );
          }),
      ],
    );
  }
}

class _Count extends StatelessWidget {
  const _Count(this.label, this.value, this.color);
  final String label;
  final int value;
  final Color color;
  @override
  Widget build(BuildContext context) => Expanded(
        child: Column(children: [
          Text('$value', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: color)),
          Text(label, style: const TextStyle(fontSize: 13, color: C.inkSoft)),
        ]),
      );
}

/* ---------------- 8. Ubayam ---------------- */

class UbayamScreen extends StatelessWidget {
  const UbayamScreen({super.key});
  @override
  Widget build(BuildContext context) {
    final draft = context.watch<BookingDraft>();
    final list = context.repo.ubayamsForDay(draft.day!.id);
    return FlowScaffold(
      step: 2,
      title: context.t('selectUbayam'),
      children: [
        if (list.isEmpty) Card(child: Padding(padding: const EdgeInsets.all(24), child: Text(context.t('noUbayam'), textAlign: TextAlign.center))),
        for (final u in list)
          Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: ChoiceCard(
              selected: draft.ubayam?.id == u.id,
              onTap: () {
                draft.update(() {
                  draft.ubayam = u;
                  if (!u.allowFamily) draft.bookingType = 'group';
                  if (!u.allowGroup) draft.bookingType = 'family';
                });
                if (u.allowFamily && u.allowGroup) {
                  pushFlow(context, const BookingTypeScreen());
                } else {
                  pushFlow(context, draft.bookingType == 'group' ? const GroupBookingScreen() : const FamilyBookingScreen());
                }
              },
              child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(context.tr(u.name), style: display(18)),
                  const SizedBox(height: 2),
                  Text(context.tr(u.description), style: const TextStyle(color: C.inkSoft)),
                ])),
                const SizedBox(width: 10),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  decoration: BoxDecoration(color: C.goldPale, borderRadius: BorderRadius.circular(12)),
                  child: Text(formatInr(u.price), style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: C.maroonDeep)),
                ),
              ]),
            ),
          ),
      ],
    );
  }
}

/* ---------------- Family / Group choice ---------------- */

class BookingTypeScreen extends StatelessWidget {
  const BookingTypeScreen({super.key});
  @override
  Widget build(BuildContext context) {
    final draft = context.watch<BookingDraft>();
    Widget option(String type, IconData icon, String title, String desc, Widget next) => Padding(
          padding: const EdgeInsets.only(bottom: 12),
          child: ChoiceCard(
            selected: draft.bookingType == type,
            onTap: () {
              draft.update(() => draft.bookingType = type);
              pushFlow(context, next);
            },
            child: Row(children: [
              CircleAvatar(radius: 30, backgroundColor: C.saffronPale, child: Icon(icon, size: 32, color: C.crimson)),
              const SizedBox(width: 16),
              Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(title, style: display(21)),
                Text(desc, style: const TextStyle(color: C.inkSoft)),
              ])),
              const Icon(Icons.chevron_right),
            ]),
          ),
        );
    return FlowScaffold(step: 3, title: context.t('selectType'), children: [
      option('family', Icons.family_restroom, context.t('family'), context.t('familyDesc'), const FamilyBookingScreen()),
      option('group', Icons.groups, context.t('group'), context.t('groupDesc'), const GroupBookingScreen()),
    ]);
  }
}

/* ---------------- shared contact fields ---------------- */

class _ContactFields extends StatelessWidget {
  const _ContactFields({required this.errors});
  final Map<String, String> errors;
  @override
  Widget build(BuildContext context) {
    final draft = context.read<BookingDraft>();
    return Column(children: [
      TextFormField(
        initialValue: draft.contactName,
        textCapitalization: TextCapitalization.words,
        style: const TextStyle(fontSize: 18),
        decoration: InputDecoration(labelText: context.t('fullName'), errorText: errors['contactName']),
        onChanged: (v) => draft.contactName = v,
      ),
      const SizedBox(height: 14),
      TextFormField(
        initialValue: draft.mobile,
        keyboardType: TextInputType.phone,
        maxLength: 14,
        style: const TextStyle(fontSize: 18),
        decoration: InputDecoration(labelText: context.t('mobileNumber'), prefixText: '+91 ', errorText: errors['mobile'], counterText: ''),
        onChanged: (v) => draft.mobile = v,
      ),
      const SizedBox(height: 14),
    ]);
  }
}

Map<String, String> _validateContact(BuildContext context, BookingDraft d) {
  final app = context.appRead;
  return {
    if (d.contactName.trim().length < 2) 'contactName': app.t('err_required'),
    if (normalizeMobile(d.mobile) == null) 'mobile': app.t('err_mobile'),
  };
}

/* ---------------- 9. Family booking ---------------- */

class FamilyBookingScreen extends StatefulWidget {
  const FamilyBookingScreen({super.key});
  @override
  State<FamilyBookingScreen> createState() => _FamilyBookingScreenState();
}

class _FamilyBookingScreenState extends State<FamilyBookingScreen> {
  Map<String, String> errors = {};

  @override
  Widget build(BuildContext context) {
    final draft = context.watch<BookingDraft>();
    final max = context.repo.settings?.maxMembersPerBooking ?? 25;
    return FlowScaffold(
      step: 4,
      title: context.t('enterDetails'),
      sub: context.t('family'),
      bottom: FilledButton(
        onPressed: () {
          final e = _validateContact(context, draft);
          if (draft.familyName.trim().length < 2) e['familyName'] = context.appRead.t('err_required');
          setState(() => errors = e);
          if (e.isEmpty) pushFlow(context, const SummaryScreen());
        },
        child: Text(context.t('next')),
      ),
      children: [
        _ContactFields(errors: errors),
        TextFormField(
          initialValue: draft.familyName,
          textCapitalization: TextCapitalization.words,
          style: const TextStyle(fontSize: 18),
          decoration: InputDecoration(labelText: context.t('familyName'), hintText: context.t('familyNamePh'), errorText: errors['familyName']),
          onChanged: (v) => draft.familyName = v,
        ),
        const SizedBox(height: 18),
        Text(context.t('memberCount'), style: const TextStyle(fontWeight: FontWeight.w700, color: C.inkSoft)),
        const SizedBox(height: 8),
        Stepper2(value: draft.memberCount, max: max, onChanged: (n) => draft.update(() => draft.memberCount = n)),
        const SizedBox(height: 18),
        TextFormField(
          initialValue: draft.memberNames,
          minLines: 3,
          maxLines: 8,
          style: const TextStyle(fontSize: 17),
          decoration: InputDecoration(labelText: context.t('memberNames'), hintText: context.t('memberNamesPh'), alignLabelWithHint: true),
          onChanged: (v) => draft.memberNames = v,
        ),
        const SizedBox(height: 14),
        TextFormField(
          initialValue: draft.note,
          minLines: 2,
          maxLines: 5,
          maxLength: 500,
          decoration: InputDecoration(labelText: context.t('note'), alignLabelWithHint: true),
          onChanged: (v) => draft.note = v,
        ),
      ],
    );
  }
}

/* ---------------- 10. Group booking ---------------- */

class GroupBookingScreen extends StatefulWidget {
  const GroupBookingScreen({super.key});
  @override
  State<GroupBookingScreen> createState() => _GroupBookingScreenState();
}

class _GroupBookingScreenState extends State<GroupBookingScreen> {
  Map<String, String> errors = {};
  final List<TextEditingController> _names = [];

  @override
  void initState() {
    super.initState();
    for (final f in context.read<BookingDraft>().families) {
      _names.add(TextEditingController(text: f.familyName));
    }
  }

  @override
  void dispose() {
    for (final c in _names) {
      c.dispose();
    }
    super.dispose();
  }

  void _setFamily(int i, GroupFamily f) {
    final d = context.read<BookingDraft>();
    d.update(() => d.families = [for (var j = 0; j < d.families.length; j++) j == i ? f : d.families[j]]);
  }

  @override
  Widget build(BuildContext context) {
    final draft = context.watch<BookingDraft>();
    final max = context.repo.settings?.maxMembersPerBooking ?? 25;
    return FlowScaffold(
      step: 4,
      title: context.t('enterDetails'),
      sub: context.t('group'),
      bottom: FilledButton(
        onPressed: () {
          final e = _validateContact(context, draft);
          if (draft.groupName.trim().length < 2) e['groupName'] = context.appRead.t('err_required');
          for (var i = 0; i < draft.families.length; i++) {
            if (draft.families[i].familyName.trim().isEmpty) e['fam$i'] = context.appRead.t('err_required');
          }
          setState(() => errors = e);
          if (e.isEmpty) pushFlow(context, const SummaryScreen());
        },
        child: Text(context.t('next')),
      ),
      children: [
        _ContactFields(errors: errors),
        TextFormField(
          initialValue: draft.groupName,
          textCapitalization: TextCapitalization.words,
          style: const TextStyle(fontSize: 18),
          decoration: InputDecoration(labelText: context.t('groupName'), hintText: context.t('groupNamePh'), errorText: errors['groupName']),
          onChanged: (v) => draft.groupName = v,
        ),
        const SizedBox(height: 18),
        Text(context.t('families'), style: const TextStyle(fontWeight: FontWeight.w700, color: C.inkSoft)),
        const SizedBox(height: 8),
        for (var i = 0; i < draft.families.length; i++)
          Container(
            margin: const EdgeInsets.only(bottom: 12),
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(color: C.cream, borderRadius: BorderRadius.circular(16), border: Border.all(color: C.gold.withValues(alpha: .3))),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [
                Expanded(child: Text('${context.t('family')} ${i + 1}', style: const TextStyle(fontWeight: FontWeight.w700, color: C.inkSoft))),
                if (draft.families.length > 2)
                  TextButton(
                    onPressed: () {
                      _names.removeAt(i).dispose();
                      draft.update(() => draft.families = [...draft.families]..removeAt(i));
                    },
                    child: Text(context.t('remove'), style: const TextStyle(color: C.crimson)),
                  ),
              ]),
              TextField(
                controller: _names[i],
                textCapitalization: TextCapitalization.words,
                decoration: InputDecoration(hintText: context.t('familyName'), errorText: errors['fam$i']),
                onChanged: (v) => _setFamily(i, GroupFamily(v, draft.families[i].memberCount)),
              ),
              const SizedBox(height: 10),
              Row(children: [
                Expanded(child: Text(context.t('members'))),
                Stepper2(value: draft.families[i].memberCount, max: max, onChanged: (n) => _setFamily(i, GroupFamily(draft.families[i].familyName, n))),
              ]),
            ]),
          ),
        Row(children: [
          OutlinedButton.icon(
            style: OutlinedButton.styleFrom(minimumSize: const Size(0, 50)),
            onPressed: draft.families.length >= 50
                ? null
                : () {
                    _names.add(TextEditingController());
                    draft.update(() => draft.families = [...draft.families, const GroupFamily('', 1)]);
                  },
            icon: const Icon(Icons.add),
            label: Text(context.t('addFamily').replaceAll('+ ', '')),
          ),
          const Spacer(),
          Text('${context.t('totalMembers')}: ${draft.totalMembers}', style: const TextStyle(fontWeight: FontWeight.w800, color: C.maroon)),
        ]),
        const SizedBox(height: 16),
        TextFormField(
          initialValue: draft.note,
          minLines: 2,
          maxLines: 5,
          maxLength: 500,
          decoration: InputDecoration(labelText: context.t('note'), alignLabelWithHint: true),
          onChanged: (v) => draft.note = v,
        ),
      ],
    );
  }
}

/* ---------------- 11. Summary ---------------- */

class SummaryScreen extends StatefulWidget {
  const SummaryScreen({super.key});
  @override
  State<SummaryScreen> createState() => _SummaryScreenState();
}

class _SummaryScreenState extends State<SummaryScreen> {
  bool busy = false;
  String? error;

  Future<void> _submit() async {
    final draft = context.read<BookingDraft>();
    final app = context.appRead;
    setState(() {
      busy = true;
      error = null;
    });
    try {
      final input = draft.toInput()..['mobileNumber'] = normalizeMobile(draft.mobile);
      final res = await Api.createBooking(input, app.lang);
      if (!mounted) return;
      final id = '${res['bookingId']}';
      // Leave the flow and open the booking's payment page.
      final nav = Navigator.of(context);
      nav.popUntil((r) => r.isFirst);
      nav.push(MaterialPageRoute(builder: (_) => BookingDetailsScreen(bookingId: id)));
    } on AppError catch (e) {
      if (!mounted) return;
      setState(() {
        busy = false;
        error = e.message;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final d = context.watch<BookingDraft>();
    final lang = context.lang;
    final ub = d.ubayam!;
    return FlowScaffold(
      step: 5,
      title: context.t('summary'),
      sub: context.t('checkDetails'),
      bottom: Column(mainAxisSize: MainAxisSize.min, children: [
        ErrorBox(error),
        GoldButton(label: context.t('proceedToPay'), icon: Icons.check_circle_outline, busy: busy, onPressed: _submit),
      ]),
      children: [
        Card(
          clipBehavior: Clip.antiAlias,
          child: Column(children: [
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(16),
              decoration: const BoxDecoration(gradient: LinearGradient(colors: [C.maroon, C.crimson])),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(context.tr(ub.name), style: display(20, color: C.goldLight)),
                const SizedBox(height: 2),
                Text('${context.tr(d.day!.dayName)} · ${formatDate(d.day!.date, lang, weekday: true)} · ${formatTime(d.slot!.time, lang)}',
                    style: const TextStyle(color: C.cream, fontSize: 16)),
              ]),
            ),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
              child: Column(children: [
                DetailRow(context.t('fullName'), d.contactName),
                DetailRow(context.t('mobileNumber'), normalizeMobile(d.mobile) ?? d.mobile),
                if (d.bookingType == 'family') ...[
                  DetailRow(context.t('familyName'), d.familyName),
                  DetailRow(context.t('members'), '${d.memberCount}'),
                ] else ...[
                  DetailRow(context.t('groupName'), d.groupName),
                  DetailRow(context.t('families'), d.families.map((f) => '${f.familyName} – ${f.memberCount}').join('\n')),
                  DetailRow(context.t('totalMembers'), '${d.totalMembers}'),
                ],
                if (d.note.trim().isNotEmpty) DetailRow(context.t('note'), d.note),
              ]),
            ),
            Container(
              color: C.goldPale.withValues(alpha: .5),
              padding: const EdgeInsets.all(16),
              child: Row(children: [
                Expanded(child: Text(context.t('amountToPay'), style: const TextStyle(fontWeight: FontWeight.w700, color: C.inkSoft))),
                Text(formatInr(ub.price), style: display(28, color: C.crimson)),
              ]),
            ),
          ]),
        ),
        const SizedBox(height: 12),
        Text(context.t('holdNotice', {'m': context.repo.settings?.holdMinutes ?? 30}), style: const TextStyle(color: C.inkSoft)),
      ],
    );
  }
}
