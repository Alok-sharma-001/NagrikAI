"use client";

import { useState } from "react";
import { t } from "@/lib/i18n";
import { FIELD_NAMES, formatProfileValue, VALUE_NAMES } from "@/lib/labels";
import { OCCUPATIONS, STUDY_LEVELS, type Lang, type Profile, type ProfileField } from "@/lib/types";

type FieldSpec =
  | { field: ProfileField; kind: "number"; min?: number; max?: number; step?: number; suffix?: { en: string; hi: string } }
  | { field: ProfileField; kind: "text" }
  | { field: ProfileField; kind: "enum"; options: readonly string[] }
  | { field: ProfileField; kind: "bool" };

const GROUPS: { title: { en: string; hi: string }; fields: FieldSpec[] }[] = [
  {
    title: { en: "About you", hi: "आपके बारे में" },
    fields: [
      { field: "name", kind: "text" },
      { field: "age", kind: "number", min: 0, max: 120 },
      { field: "gender", kind: "enum", options: ["female", "male", "transgender"] },
      { field: "maritalStatus", kind: "enum", options: ["married", "single", "widowed", "divorced"] },
      { field: "category", kind: "enum", options: ["general", "obc", "sc", "st", "ews"] },
      { field: "isMinority", kind: "bool" },
      { field: "isDisabled", kind: "bool" },
      { field: "disabilityPercent", kind: "number", min: 0, max: 100, suffix: { en: "%", hi: "%" } },
    ],
  },
  {
    title: { en: "Where & work", hi: "स्थान और काम" },
    fields: [
      { field: "state", kind: "text" },
      { field: "area", kind: "enum", options: ["rural", "urban"] },
      { field: "occupation", kind: "enum", options: OCCUPATIONS },
      { field: "annualIncome", kind: "number", min: 0, step: 1000, suffix: { en: "₹ / year", hi: "₹ / वर्ष" } },
      { field: "landHectares", kind: "number", min: 0, step: 0.1, suffix: { en: "hectare", hi: "हेक्टेयर" } },
      { field: "isIncomeTaxPayer", kind: "bool" },
      { field: "isGovtEmployee", kind: "bool" },
      { field: "isEpfoMember", kind: "bool" },
      { field: "wantsToStartBusiness", kind: "bool" },
    ],
  },
  {
    title: { en: "Home & family", hi: "घर और परिवार" },
    fields: [
      { field: "isBPL", kind: "bool" },
      { field: "hasBankAccount", kind: "bool" },
      { field: "ownsPuccaHouse", kind: "bool" },
      { field: "hasLpgConnection", kind: "bool" },
      { field: "hasToilet", kind: "bool" },
      { field: "isPregnantOrLactating", kind: "bool" },
      { field: "hasChildUnder6", kind: "bool" },
      { field: "hasSchoolChildren", kind: "bool" },
      { field: "hasGirlChildUnder10", kind: "bool" },
      { field: "breadwinnerDiedRecently", kind: "bool" },
    ],
  },
  {
    title: { en: "Studies", hi: "पढ़ाई" },
    fields: [
      { field: "isStudent", kind: "bool" },
      { field: "studyLevel", kind: "enum", options: STUDY_LEVELS },
    ],
  },
];

type Props = {
  lang: Lang;
  profile: Profile;
  onChange: (patch: Partial<Profile>, removed?: ProfileField[]) => void;
  onClear: () => void;
};

export default function ProfilePanel({ lang, profile, onChange, onClear }: Props) {
  const [open, setOpen] = useState(false);
  const set = (Object.keys(profile) as ProfileField[]).filter((k) => profile[k] !== undefined);

  return (
    <div className="rounded-lg border border-line bg-surface p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="font-semibold">{t("yourProfile", lang)}</h2>
        <div className="flex gap-2">
          <button onClick={() => setOpen((o) => !o)} className="rounded-full border border-line px-3 py-1.5 text-sm">
            {open ? t("closeForm", lang) : t("editProfile", lang)}
          </button>
          {set.length > 0 && (
            <button onClick={onClear} className="rounded-full px-3 py-1.5 text-sm text-bad underline">
              {t("clearData", lang)}
            </button>
          )}
        </div>
      </div>

      {!open && (
        set.length ? (
          <div className="flex flex-wrap gap-1.5">
            {set.map((k) => (
              <span key={k} className="rounded-lg bg-surface-2 px-2.5 py-1 text-sm">
                <span className="text-muted">{FIELD_NAMES[k][lang]}:</span> {formatProfileValue(k, profile[k], lang)}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted">{t("emptyResults", lang)}</p>
        )
      )}

      {open && (
        <div className="space-y-5">
          {GROUPS.map((g) => (
            <fieldset key={g.title.en}>
              <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">{g.title[lang]}</legend>
              <div className="grid gap-3 sm:grid-cols-2">
                {g.fields.map((spec) => (
                  <FieldInput key={spec.field} spec={spec} lang={lang} value={profile[spec.field]} onChange={onChange} />
                ))}
              </div>
            </fieldset>
          ))}
        </div>
      )}
    </div>
  );
}

function FieldInput({ spec, lang, value, onChange }: { spec: FieldSpec; lang: Lang; value: unknown; onChange: Props["onChange"] }) {
  const f = spec.field;
  const id = `f-${f}`;
  const label = (
    <label htmlFor={id} className="mb-1 block text-sm text-muted">
      {FIELD_NAMES[f][lang]}
      {"suffix" in spec && spec.suffix ? ` (${spec.suffix[lang]})` : ""}
    </label>
  );
  const inputCls = "h-11 w-full rounded-lg border border-line bg-bg px-3 outline-none focus:border-primary";

  if (spec.kind === "bool") {
    const opts: [string, boolean | undefined][] = [[t("yes", lang), true], [t("no", lang), false], ["—", undefined]];
    return (
      <div>
        <span className="mb-1 block text-sm text-muted" id={id}>{FIELD_NAMES[f][lang]}</span>
        <div className="flex overflow-hidden rounded-lg border border-line" role="group" aria-labelledby={id}>
          {opts.map(([lbl, v]) => (
            <button
              key={lbl}
              type="button"
              aria-pressed={value === v}
              onClick={() => (v === undefined ? onChange({}, [f]) : onChange({ [f]: v }))}
              className={`h-11 flex-1 text-sm ${value === v ? "bg-primary text-primary-ink" : "bg-bg"}`}
            >
              {lbl}
            </button>
          ))}
        </div>
      </div>
    );
  }
  if (spec.kind === "enum") {
    return (
      <div>
        {label}
        <select
          id={id}
          value={(value as string) ?? ""}
          onChange={(e) => (e.target.value ? onChange({ [f]: e.target.value }) : onChange({}, [f]))}
          className={inputCls}
        >
          <option value="">{t("notSet", lang)}</option>
          {spec.options.map((o) => (
            <option key={o} value={o}>{VALUE_NAMES[o]?.[lang] ?? o}</option>
          ))}
        </select>
      </div>
    );
  }
  if (spec.kind === "number") {
    return (
      <div>
        {label}
        <input
          id={id}
          type="number"
          inputMode="decimal"
          min={spec.min}
          max={spec.max}
          step={spec.step ?? 1}
          value={value === undefined ? "" : String(value)}
          onChange={(e) => (e.target.value === "" ? onChange({}, [f]) : onChange({ [f]: Number(e.target.value) }))}
          className={inputCls}
        />
      </div>
    );
  }
  return (
    <div>
      {label}
      <input
        id={id}
        value={(value as string) ?? ""}
        onChange={(e) => (e.target.value ? onChange({ [f]: e.target.value }) : onChange({}, [f]))}
        className={inputCls}
      />
    </div>
  );
}
