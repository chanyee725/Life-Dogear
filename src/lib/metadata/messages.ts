import type { MetadataErrorCode } from "./types";

/** Korean message shown under the "링크로 채우기" box for each failure. */
export const METADATA_ERROR_MESSAGES: Record<MetadataErrorCode, string> = {
  invalid_input:
    "DOI나 arXiv 링크 형식이 아닙니다. 예: 10.1145/3292500.3330701, arxiv.org/abs/2101.00001",
  not_found: "해당하는 논문 정보를 찾지 못했습니다. DOI나 arXiv 번호를 확인해 주세요.",
  upstream_error: "논문 정보 서비스가 응답하지 않습니다. 잠시 후 다시 시도해 주세요.",
  parse_error: "받은 논문 정보를 읽지 못했습니다. 직접 입력해 주세요.",
  timeout: "응답이 너무 늦어 중단했습니다. 잠시 후 다시 시도해 주세요.",
  network_error: "논문 정보 서비스에 연결하지 못했습니다. 인터넷 연결을 확인해 주세요.",
};

export function metadataErrorMessage(code: MetadataErrorCode): string {
  return METADATA_ERROR_MESSAGES[code];
}
