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
  children: ReactNode;
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
  <p className="text-[13px] leading-relaxed text-muted">{children}</p>
);

/**
 * One editable setting: the current value only as a server-made mask, an empty input to
 * replace it, and "앱 설정 지우기" (back to the server env) when the app holds a value.
 */
function EditableSetting({
  settingKey,
  label,
  hint,
  placeholder,
  multiline,
  source,
  masked,
  onSaved,
}: {
  settingKey: EditableKey;
  label: string;
  hint: ReactNode;
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
        <span className="text-muted">
          현재: {SOURCE_LABEL[source]}
          {source === "env" ? " (앱에 저장하면 이 값보다 우선합니다)" : ""}
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
      <Field label={label} htmlFor={id} hint={hint} error={error ?? undefined}>
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
        <Note>
          Google 캘린더 일정을 달력에 함께 보여 줍니다. Google 캘린더 → 설정 → 내 캘린더 → 캘린더
          통합 → “iCal 형식의 비공개 주소”를 붙여넣으세요. 비밀번호처럼 다뤄 주세요.
        </Note>
        <EditableSetting
          settingKey="GOOGLE_CALENDAR_ICS_URLS"
          label="iCal 비공개 주소"
          hint="여러 개는 줄을 바꾸거나 쉼표로 구분합니다. 저장하면 지금 값을 모두 바꿉니다."
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
        <Note>
          {write.connected
            ? "달력의 ‘일정 추가’로 Google 캘린더에 일정을 넣을 수 있습니다."
            : "‘일정 추가’를 쓰려면 서버를 관리하는 사람이 Google 캘린더 쓰기 키를 서버에 등록해야 합니다(docs/DEPLOY.md 7절). 이 키는 보안상 앱에서 넣을 수 없습니다."}
        </Note>
        <EditableSetting
          settingKey="GOOGLE_CALENDAR_ID"
          label="일정을 넣을 캘린더 ID"
          hint="비우면 기본 캘린더(primary)에 넣습니다. Google 캘린더 → 설정 → 캘린더 통합 → 캘린더 ID."
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
        <Note>
          {view.storage.kind === "s3"
            ? "사진과 PDF를 공유 저장소(S3 호환)에 둡니다. 같은 데이터베이스를 쓰는 모든 컴퓨터에서 같은 파일이 보입니다."
            : "사진과 PDF를 이 컴퓨터의 데이터 폴더에 둡니다. 여러 컴퓨터에서 함께 쓰려면 서버를 관리하는 사람이 공유 저장소를 설정해야 합니다(.env.example)."}{" "}
          저장소는 서버 설정이라 앱에서 바꿀 수 없습니다.
        </Note>
      </Block>

      <Block id="liner" title="Liner" status={<Status on>설정 필요 없음</Status>}>
        <Note>
          따로 연결할 계정이나 키가 없습니다. 논문 화면에서 Liner로 열고, Liner의
          답변·요약·하이라이트를 논문 메모로 붙여넣어 씁니다.
        </Note>
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
        <Note>
          {view.auth.mode === "login"
            ? `허용된 계정 ${view.auth.allowedCount}개만 로그인할 수 있습니다.`
            : "로그인 없이 이 컴퓨터에서만 열립니다."}{" "}
          로그인과 허용 계정은 보안 설정이라 앱에서 바꿀 수 없고, 서버 환경 설정에서만 바꿉니다.
        </Note>
      </Block>
    </div>
  );
}
