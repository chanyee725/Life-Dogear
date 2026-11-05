"use client";

import { useState } from "react";
import { EnumSelect } from "@/components/fields/EnumSelect";
import { Property } from "@/components/fields/Properties";
import { Input } from "@/components/ui/Input";
import { SEMINAR_KIND, type SeminarKind } from "@/lib/enums";

/** Field labels per kind: 들은 것 (attended) vs 한 것 (given). Same columns either way. */
export const KIND_FIELD_LABELS: Record<
  SeminarKind,
  { speaker: string; hostVenue: string; hostPlaceholder?: string; materialUrl: string }
> = {
  seminar: { speaker: "연사", hostVenue: "장소·주최", materialUrl: "자료 링크" },
  talk: {
    speaker: "함께한 사람",
    hostVenue: "대상·장소",
    hostPlaceholder: "예: ○○고 2학년",
    materialUrl: "발표 자료",
  },
};

/** 종류 select plus the fields whose labels follow it. */
export function SeminarKindFields({
  kind: initialKind,
  speaker,
  hostVenue,
  materialUrl,
}: {
  kind: SeminarKind;
  speaker: string;
  hostVenue: string;
  materialUrl: string;
}) {
  const [kind, setKind] = useState<SeminarKind>(initialKind);
  const labels = KIND_FIELD_LABELS[kind];
  return (
    <>
      <Property label="종류" htmlFor="seminar-kind">
        <EnumSelect
          id="seminar-kind"
          name="kind"
          options={SEMINAR_KIND.options}
          defaultValue={initialKind}
          onChange={(v) => {
            if (SEMINAR_KIND.is(v)) setKind(v);
          }}
          className="w-auto"
        />
      </Property>
      <Property label={labels.speaker} htmlFor="seminar-speaker">
        <Input id="seminar-speaker" name="speaker" defaultValue={speaker} />
      </Property>
      <Property label={labels.hostVenue} htmlFor="seminar-host">
        <Input
          id="seminar-host"
          name="hostVenue"
          defaultValue={hostVenue}
          placeholder={labels.hostPlaceholder}
        />
      </Property>
      <Property label={labels.materialUrl} htmlFor="seminar-material">
        <Input
          id="seminar-material"
          name="materialUrl"
          inputMode="url"
          defaultValue={materialUrl}
          placeholder="https://"
        />
      </Property>
    </>
  );
}
