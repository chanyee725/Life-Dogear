"use client";

import { useId, useState, useTransition, type FormEvent, type ReactNode } from "react";
import { saveAppSetting } from "@/app/_actions/settings";
import { ThemeToggle } from "@/components/shell/ThemeToggle";
import { Badge, Button, Field, Input, Textarea } from "@/components/ui";
import type { EditableKey, SettingSource, SettingsView } from "@/lib/settings/types";

const SOURCE_LABEL: Record<SettingSource, string> = {
  app: "앱에 저장됨",
  env: "서버 환경 설정",
  none: "설정 안 됨",
};

function Block({
  id,
  title,
  status,
  children,
}: {
  id: string;
  title: string;
  status?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className="flex scroll-mt-6 flex-col gap-3 border-t border-border py-6 first:border-t-0 first:pt-0"
    >
      <div className="flex items-center gap-2">
        <h2 id={`${id}-title`} className="text-[15px] font-semibold text-fg">
          {title}
        </h2>
        {status}
      </div>
      {children}
    </section>
  );
}

const Status = ({ on, children }: { on: boolean; children: ReactNode }) => (
  <Badge tone={on ? "green" : "gray"} data-testid="settings-status">
    {children}
  </Badge>
);

const Note = ({ children }: { children: ReactNode }) => (
  <p className="text-[13px] text-muted">{children}</p>
);

/** A small ⓘ with the explanation in a native tooltip. */
const Info = ({ text }: { text: string }) => (
  <span title={text} aria-label={text} role="img" className="cursor-help text-muted">
    ⓘ
  </span>
);

/**
 * One editable setting: the current value only as a server-made mask, an empty input to
 * replace it, and "앱 설정 지우기" (back to the server env) when the app holds a value.
 */
function EditableSetting({
  settingKey,
  label,
  placeholder,
  multiline,
  source,
  masked,
  onSaved,
}: {
  settingKey: EditableKey;
  label: string;
  placeholder: string;
  multiline?: boolean;
  source: SettingSource;
  masked: string[];
  onSaved: (view: SettingsView, message: string) => void;
}) {
  const id = useId();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const save = (next: string, done: string) =>
    start(async () => {
      const result = await saveAppSetting(settingKey, next);
      if (!result.ok) return setError(result.error);
      setError(null);
      setValue("");
      onSaved(result.data, done);
    });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!value.trim() || pending) return;
    save(value, "저장했습니다.");
  };

  const control = {
    id,
    value,
    placeholder,
    autoComplete: "off",
    spellCheck: false,
    disabled: pending,
    "aria-invalid": error ? true : undefined,
    onChange: (e: { target: { value: string } }) => setValue(e.target.value),
  } as const;

  return (
    <form onSubmit={submit} className="flex flex-col gap-2" noValidate>
      <div className="flex flex-col gap-1 text-[13px]">
        <span className="flex items-center gap-1 text-muted">
          현재: {SOURCE_LABEL[source]}
          {masked.length > 0 ? <Info text="값은 일부만 가려서 보여 줍니다." /> : null}
        </span>
        {masked.length > 0 ? (
          <ul
            className="flex flex-col gap-0.5 font-mono text-xs text-fg"
            aria-label={`${label} 현재 값`}
          >
            {masked.map((m, i) => (
              <li key={i}>{m}</li>
            ))}
          </ul>
        ) : null}
      </div>
      <Field label={label} htmlFor={id} error={error ?? undefined}>
        {multiline ? <Textarea rows={2} {...control} /> : <Input {...control} />}
      </Field>
      <div className="flex gap-2">
        <Button type="submit" variant="primary" size="sm" disabled={pending || !value.trim()}>
          {pending ? "저장 중…" : "저장"}
        </Button>
        {source === "app" ? (
          <Button
            variant="ghost"
            size="sm"
            disabled={pending}
            onClick={() => save("", "앱 설정을 지웠습니다.")}
          >
            앱 설정 지우기
          </Button>
        ) : null}
      </div>
    </form>
  );
}

export function SettingsPanel({ initial }: { initial: SettingsView }) {
  const [view, setView] = useState(initial);
  const [message, setMessage] = useState("");
  const onSaved = (next: SettingsView, done: string) => {
    setView(next);
    setMessage(done);
  };
  const read = view.calendarRead;
  const write = view.calendarWrite;

  return (
    <div className="flex flex-col">
      <p role="status" className="sr-only">
        {message}
      </p>

      <Block id="display" title="화면">
        <Field label="테마">
          <ThemeToggle className="max-w-sm" />
        </Field>
      </Block>

      <Block
        id="calendar"
        title="Google 캘린더 읽기"
        status={
          <Status on={read.masked.length > 0}>
            {read.masked.length > 0 ? "연결됨" : "연결 안 됨"}
          </Status>
        }
      >
        <EditableSetting
          settingKey="GOOGLE_CALENDAR_ICS_URLS"
          label="iCal 비공개 주소"
          placeholder="https://calendar.google.com/calendar/ical/…/basic.ics"
          multiline
          source={read.source}
          masked={read.masked}
          onSaved={onSaved}
        />
      </Block>

      <Block
        id="calendar-write"
        title="Google 캘린더 쓰기"
        status={<Status on={write.connected}>{write.connected ? "연결됨" : "연결 안 됨"}</Status>}
      >
        {write.connected ? null : <Note>서버에 쓰기 키가 없어 일정을 추가할 수 없습니다.</Note>}
        <EditableSetting
          settingKey="GOOGLE_CALENDAR_ID"
          label="일정을 넣을 캘린더 ID"
          placeholder="primary"
          source={view.calendarId.source}
          masked={view.calendarId.masked ? [view.calendarId.masked] : ["기본 캘린더(primary)"]}
          onSaved={onSaved}
        />
      </Block>

      <Block
        id="storage"
        title="파일 저장소"
        status={
          <Status on={view.storage.kind === "s3"}>
            {view.storage.kind === "s3" ? "공유 저장소" : "이 컴퓨터"}
          </Status>
        }
      >
      </Block>

      <Block id="liner" title="Liner" status={<Status on>설정 필요 없음</Status>}>
      </Block>

      <Block
        id="security"
        title="로그인·보안"
        status={
          <Status on={view.auth.mode === "login"}>
            {view.auth.mode === "login"
              ? "Google 로그인"
              : view.auth.mode === "local"
                ? "이 컴퓨터 전용"
                : "설정 필요"}
          </Status>
        }
      >
        {view.auth.mode === "login" ? (
          <Note>허용된 계정 {view.auth.allowedCount}개</Note>
        ) : null}
      </Block>
    </div>
  );
}
